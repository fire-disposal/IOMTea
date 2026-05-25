import { z } from 'zod'
import { events } from '../../db/schema.js'
import { getMetricOrDefault } from '../../pipeline/registry'
import { createChildLogger } from '../../lib/logger'
import { protectedProcedure, router } from '../index'

const logger = createChildLogger('ingest')

const singleEventSchema = z.object({
  patientId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  pinCode: z.string().optional(),
  kind: z.string(),
  source: z.string(),
  metric: z.string().min(1),
  value: z.unknown(),
  unit: z.string().optional(),
  confidence: z.number().optional(),
  tags: z.record(z.unknown()).optional(),
  recordedAt: z.string().datetime().optional(),
})

const batchEventsSchema = z.object({
  events: z.array(singleEventSchema).min(1).max(5000),
})

export const ingestRouter = router({
  single: protectedProcedure
    .input(singleEventSchema)
    .mutation(async ({ ctx, input }) => {
      const def = getMetricOrDefault(input.metric)

      const parsed = def.valueSchema.safeParse(input.value)
      if (!parsed.success) {
        logger.warn({ metric: input.metric, errors: parsed.error.issues }, 'ingest validation failed')
        throw new Error(`Value validation failed for metric "${input.metric}": ${parsed.error.message}`)
      }

      const [row] = await ctx.db.insert(events).values({
        patientId: input.patientId,
        sessionId: input.sessionId ?? null,
        pinCode: input.pinCode ?? null,
        kind: input.kind,
        source: input.source,
        metric: input.metric,
        value: parsed.data,
        unit: input.unit ?? def.unit ?? null,
        confidence: input.confidence ?? 1.0,
        tags: input.tags ?? {},
        recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      } as any).returning()

      return row
    }),

  batch: protectedProcedure
    .input(batchEventsSchema)
    .mutation(async ({ ctx, input }) => {
      const results = { success: 0, failed: 0, skipped: 0, errors: [] as string[] }

      for (const event of input.events) {
        try {
          const def = getMetricOrDefault(event.metric)
          const parsed = def.valueSchema.safeParse(event.value)
          if (!parsed.success) {
            results.skipped++
            results.errors.push(`metric=${event.metric}: ${parsed.error.message}`)
            continue
          }

          await ctx.db.insert(events).values({
            patientId: event.patientId,
            sessionId: event.sessionId ?? null,
            pinCode: event.pinCode ?? null,
            kind: event.kind,
            source: event.source,
            metric: event.metric,
            value: parsed.data,
            unit: event.unit ?? def.unit ?? null,
            confidence: event.confidence ?? 1.0,
            tags: event.tags ?? {},
            recordedAt: event.recordedAt ? new Date(event.recordedAt) : new Date(),
          } as any)

          results.success++
        } catch (err) {
          results.failed++
          results.errors.push(`metric=${event.metric}: ${(err as Error).message}`)
        }
      }

      logger.info({ ...results }, 'batch ingest completed')
      return results
    }),

  validate: protectedProcedure
    .input(z.object({
      metric: z.string(),
      value: z.unknown(),
    }))
    .query(async ({ input }) => {
      const def = getMetricOrDefault(input.metric)
      const parsed = def.valueSchema.safeParse(input.value)
      if (!parsed.success) {
        return { valid: false, errors: parsed.error.issues }
      }
      return { valid: true, errors: [] }
    }),
})
