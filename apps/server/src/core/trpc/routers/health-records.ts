import { TRPCError } from '@trpc/server'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { events, patients, users } from '../../db/schema'
import { dailyChecklists, streaks, creditTransactions } from '../../db/schema/plan'
import { calculateCredit, calcNewStreak } from '../../../services/credit-calculator'
import { protectedProcedure, router } from '../index'

const healthRecordType = z.enum([
  'blood_glucose',
  'blood_pressure',
  'weight',
  'heart_rate',
  'temperature',
  'spo2',
  'medication',
  'period',
])

const healthRecordSchema = z.object({
  id: z.string(),
  type: healthRecordType,
  data: z.record(z.unknown()),
  recordedAt: z.string(),
  synced: z.boolean(),
})

const batchCreateInput = z.object({
  records: z.array(healthRecordSchema),
  patientId: z.string().uuid().optional(),
})

type RawRecord = z.infer<typeof healthRecordSchema>

interface EventInsert {
  patientId: string
  kind: 'observation' | 'behavior'
  metric: string
  value?: number | null
  unit?: string
  tags: Record<string, unknown>
  recordedAt: Date
  source: 'manual'
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function parseRecordedAt(recordedAt: string): Date {
  const parsed = new Date(recordedAt)
  if (Number.isNaN(parsed.getTime())) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid recordedAt in health record' })
  }
  return parsed
}

function requireFiniteNumber(record: RawRecord, key: string): number {
  const n = asFiniteNumber(record.data[key])
  if (n === null) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid numeric field "${key}" for ${record.type}`,
    })
  }
  return n
}

function mapRecordToEvents(record: RawRecord, patientId: string): EventInsert[] {
  const recordedAt = parseRecordedAt(record.recordedAt)
  const baseTags = { clientRecordId: record.id }
  const base: Omit<EventInsert, 'metric' | 'kind' | 'tags'> = {
    patientId,
    recordedAt,
    source: 'manual',
  }

  switch (record.type) {
    case 'blood_glucose':
      return [{
        ...base,
        kind: 'observation',
        metric: 'glucose',
        value: requireFiniteNumber(record, 'value_mgdl'),
        unit: 'mg/dL',
        tags: baseTags,
      }]
    case 'blood_pressure':
      return [
        {
          ...base,
          kind: 'observation',
          metric: 'systolic_bp',
          value: requireFiniteNumber(record, 'systolic'),
          unit: 'mmHg',
          tags: baseTags,
        },
        {
          ...base,
          kind: 'observation',
          metric: 'diastolic_bp',
          value: requireFiniteNumber(record, 'diastolic'),
          unit: 'mmHg',
          tags: baseTags,
        },
      ]
    case 'weight':
      return [{
        ...base,
        kind: 'observation',
        metric: 'weight',
        value: requireFiniteNumber(record, 'weight_kg'),
        unit: 'kg',
        tags: baseTags,
      }]
    case 'heart_rate':
      return [{
        ...base,
        kind: 'observation',
        metric: 'heart_rate',
        value: requireFiniteNumber(record, 'bpm'),
        unit: 'bpm',
        tags: baseTags,
      }]
    case 'temperature':
      return [{
        ...base,
        kind: 'observation',
        metric: 'temperature',
        value: requireFiniteNumber(record, 'celsius'),
        unit: '°C',
        tags: baseTags,
      }]
    case 'spo2':
      return [{
        ...base,
        kind: 'observation',
        metric: 'spo2',
        value: requireFiniteNumber(record, 'percentage'),
        unit: '%',
        tags: baseTags,
      }]
    case 'medication':
      return [{
        ...base,
        kind: 'behavior',
        metric: 'medication',
        tags: {
          ...baseTags,
          drug: record.data.drug,
          action: record.data.action,
        },
      }]
    case 'period':
      return [{
        ...base,
        kind: 'behavior',
        metric: 'period',
        tags: { ...baseTags, ...(record.data as Record<string, unknown>) },
      }]
  }
}

async function processCredits(
  db: any,
  userId: string,
  record: RawRecord,
  checklistId: string,
  eventId: string,
): Promise<{ amount: number; streakDay: number } | null> {
  const [existingTransaction] = await db
    .select({ id: creditTransactions.id })
    .from(creditTransactions)
    .where(eq(creditTransactions.checklistId, checklistId))
    .limit(1)

  if (existingTransaction) return null

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const [existing] = await db
    .select()
    .from(streaks)
    .where(and(eq(streaks.userId, userId), eq(streaks.moduleKey, record.type)))
    .limit(1)

  const streakResult = calcNewStreak(
    existing?.lastRecordDate ? new Date(existing.lastRecordDate) : null,
    existing?.currentStreak ?? 0,
    today,
  )
  const newStreak = streakResult.newStreak

  let currentStreak: number
  let longestStreak: number

  if (!existing) {
    currentStreak = newStreak
    longestStreak = newStreak
    await db.insert(streaks).values({
      userId,
      moduleKey: record.type,
      currentStreak,
      longestStreak,
      lastRecordDate: todayStr,
    })
  } else {
    currentStreak = newStreak
    longestStreak = Math.max(existing.longestStreak, newStreak)
    await db
      .update(streaks)
      .set({ currentStreak, longestStreak, lastRecordDate: todayStr, updatedAt: new Date() })
      .where(eq(streaks.id, existing.id))
  }

  const amount = calculateCredit(currentStreak)

  await db.insert(creditTransactions).values({
    userId,
    amount,
    moduleKey: record.type,
    streakDay: currentStreak,
    type: 'earn',
    source: 'record',
    checklistId,
    eventId,
    note: `${record.type} streak day ${currentStreak}`,
  })

  await db
    .update(users)
    .set({ credit: sql`${users.credit} + ${amount}` })
    .where(eq(users.id, userId))

  return { amount, streakDay: currentStreak }
}

export const healthRecordsRouter = router({
  batchCreate: protectedProcedure
    .input(batchCreateInput)
    .mutation(async ({ ctx, input }) => {
      let patientId = input.patientId

      if (!patientId) {
        const [patient] = await ctx.db
          .select({ id: patients.id })
          .from(patients)
          .where(eq(patients.userId, ctx.userId!))
          .orderBy(patients.createdAt)
          .limit(1)

        if (!patient) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No patient found for the authenticated user',
          })
        }
        patientId = patient.id
      } else {
        const [patient] = await ctx.db
          .select({ id: patients.id })
          .from(patients)
          .where(and(eq(patients.id, patientId), eq(patients.userId, ctx.userId!)))
          .limit(1)

        if (!patient) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Patient not found',
          })
        }
      }

      if (input.records.length === 0) {
        return { syncedIds: [], earnedCredits: [] }
      }

      const recordsById = new Map(input.records.map((record) => [record.id, record] as const))
      const dedupedRecords = [...recordsById.values()]
      const dedupedIds = dedupedRecords.map((r) => r.id)

      const existingRows = await ctx.db
        .select({
          clientRecordId: sql<string>`tags->>'clientRecordId'`,
        })
        .from(events)
        .where(
          and(
            eq(events.patientId, patientId),
            eq(events.source, 'manual'),
            inArray(sql`tags->>'clientRecordId'`, dedupedIds),
          ),
        )
      const existingIds = new Set(existingRows.map((row) => row.clientRecordId))
      const unsyncedRecords = dedupedRecords.filter((record) => !existingIds.has(record.id))

      if (unsyncedRecords.length === 0) {
        return {
          syncedIds: dedupedIds,
          earnedCredits: [],
        }
      }

      const allEvents = unsyncedRecords.flatMap((record) =>
        mapRecordToEvents(record, patientId),
      )

      const insertedEvents = await ctx.db
        .insert(events)
        .values(allEvents)
        .returning({ id: events.id, tags: events.tags })

      const firstEventIdByRecordId = new Map<string, string>()
      for (const event of insertedEvents) {
        const tags = event.tags as Record<string, unknown>
        const clientRecordId = typeof tags.clientRecordId === 'string' ? tags.clientRecordId : null
        if (clientRecordId && !firstEventIdByRecordId.has(clientRecordId)) {
          firstEventIdByRecordId.set(clientRecordId, event.id)
        }
      }

      const earnedCredits: { moduleKey: string; amount: number; streakDay: number }[] = []
      const todayStr = new Date().toISOString().slice(0, 10)

      for (const record of unsyncedRecords) {
        const eventId = firstEventIdByRecordId.get(record.id)
        if (!eventId) continue

        const [checklist] = await ctx.db
          .select()
          .from(dailyChecklists)
          .where(
            and(
              eq(dailyChecklists.userId, ctx.userId!),
              eq(dailyChecklists.date, todayStr),
              eq(dailyChecklists.moduleKey, record.type),
            ),
          )
          .limit(1)

        if (checklist?.status === 'pending') {
          await ctx.db
            .update(dailyChecklists)
            .set({ status: 'done', completedAt: new Date(), recordId: eventId })
            .where(eq(dailyChecklists.id, checklist.id))

          const creditResult = await processCredits(
            ctx.db,
            ctx.userId!,
            record,
            checklist.id,
            eventId,
          )
          if (creditResult) {
            earnedCredits.push({
              moduleKey: record.type,
              amount: creditResult.amount,
              streakDay: creditResult.streakDay,
            })
          }
        }
      }

      return {
        syncedIds: dedupedIds,
        earnedCredits,
      }
    }),
})
