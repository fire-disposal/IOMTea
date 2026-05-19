import { TRPCError } from '@trpc/server'
import { eq, and, sql } from 'drizzle-orm'
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

function mapRecordToEvents(record: RawRecord, patientId: string): EventInsert[] {
  const recordedAt = new Date(record.recordedAt)
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
        value: record.data.value_mgdl as number | null | undefined,
        unit: 'mg/dL',
        tags: {},
      }]
    case 'blood_pressure':
      return [
        {
          ...base,
          kind: 'observation',
          metric: 'systolic_bp',
          value: record.data.systolic as number | null | undefined,
          unit: 'mmHg',
          tags: {},
        },
        {
          ...base,
          kind: 'observation',
          metric: 'diastolic_bp',
          value: record.data.diastolic as number | null | undefined,
          unit: 'mmHg',
          tags: {},
        },
      ]
    case 'weight':
      return [{
        ...base,
        kind: 'observation',
        metric: 'weight',
        value: record.data.weight_kg as number | null | undefined,
        unit: 'kg',
        tags: {},
      }]
    case 'heart_rate':
      return [{
        ...base,
        kind: 'observation',
        metric: 'heart_rate',
        value: record.data.bpm as number | null | undefined,
        unit: 'bpm',
        tags: {},
      }]
    case 'temperature':
      return [{
        ...base,
        kind: 'observation',
        metric: 'temperature',
        value: record.data.celsius as number | null | undefined,
        unit: '°C',
        tags: {},
      }]
    case 'spo2':
      return [{
        ...base,
        kind: 'observation',
        metric: 'spo2',
        value: record.data.percentage as number | null | undefined,
        unit: '%',
        tags: {},
      }]
    case 'medication':
      return [{
        ...base,
        kind: 'behavior',
        metric: 'medication',
        tags: {
          drug: record.data.drug,
          action: record.data.action,
        },
      }]
    case 'period':
      return [{
        ...base,
        kind: 'behavior',
        metric: 'period',
        tags: record.data as Record<string, unknown>,
      }]
  }
}

async function processCredits(
  db: any,
  userId: string,
  record: RawRecord,
  checklistId: string,
): Promise<{ amount: number; streakDay: number } | null> {
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
          .where(eq(patients.id, patientId))
          .limit(1)

        if (!patient) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Patient not found',
          })
        }
      }

      if (input.records.length === 0) {
        return { syncedIds: [] }
      }

      const allEvents = input.records.flatMap((record) =>
        mapRecordToEvents(record, patientId),
      )

      await ctx.db.insert(events).values(allEvents)

      const earnedCredits: { moduleKey: string; amount: number; streakDay: number }[] = []
      const todayStr = new Date().toISOString().slice(0, 10)

      for (const record of input.records) {
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

        if (checklist) {
          await ctx.db
            .update(dailyChecklists)
            .set({ status: 'done', completedAt: new Date() })
            .where(eq(dailyChecklists.id, checklist.id))

          const creditResult = await processCredits(
            ctx.db,
            ctx.userId!,
            record,
            checklist.id,
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
        syncedIds: input.records.map((r) => r.id),
        earnedCredits,
      }
    }),
})
