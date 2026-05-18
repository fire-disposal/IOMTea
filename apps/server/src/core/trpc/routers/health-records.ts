import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { events, patients } from '../../db/schema'
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

      return { syncedIds: input.records.map((r) => r.id) }
    }),
})
