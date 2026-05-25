import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { db } from '../core/db'
import { events } from '../core/db/schema'
import { getMetricOrDefault } from '../core/pipeline/registry'
import { jwtAuth } from '../middleware/auth'
import { createChildLogger } from '../core/lib/logger'

const logger = createChildLogger('ingest')
const ingestApp = new OpenAPIHono()
ingestApp.use('*', jwtAuth)

const singleRoute = createRoute({
  method: 'post',
  path: '/single',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            patientId: z.string().uuid().openapi({ example: '00000000-0000-0000-0000-000000000001' }),
            sessionId: z.string().uuid().optional(),
            pinCode: z.string().optional(),
            kind: z.string().openapi({ example: 'observation' }),
            source: z.string().openapi({ example: 'device' }),
            metric: z.string().min(1).openapi({ example: 'heart_rate' }),
            value: z.unknown().openapi({}),
            unit: z.string().optional(),
            confidence: z.number().optional(),
            tags: z.record(z.string(), z.unknown()).optional(),
            recordedAt: z.string().datetime().optional(),
          }),
        },
      },
    },
  },
  responses: { 201: { description: 'Ingested' }, 400: { description: 'Validation failed' } },
})

ingestApp.openapi(singleRoute, async (c) => {
  const input = c.req.valid('json')
  const def = getMetricOrDefault(input.metric)
  const parsed = def.valueSchema.safeParse(input.value)
  if (!parsed.success) {
    logger.warn({ metric: input.metric, errors: parsed.error.issues }, 'ingest validation failed')
    return c.json({ error: `Value validation failed: ${parsed.error.message}` }, 400 as any)
  }

  const [row] = await db
    .insert(events)
    .values({
      patientId: input.patientId,
      sessionId: (input as any).sessionId ?? null,
      pinCode: (input as any).pinCode ?? null,
      kind: input.kind,
      source: input.source,
      metric: input.metric,
      value: parsed.data as any,
      unit: input.unit ?? def.unit ?? null,
      confidence: input.confidence ?? 1.0,
      tags: input.tags ?? {},
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
    } as any)
    .returning()

  return c.json(row, 201 as any)
})

const batchRoute = createRoute({
  method: 'post',
  path: '/batch',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            events: z.array(z.object({
              patientId: z.string().uuid(),
              sessionId: z.string().uuid().optional(),
              pinCode: z.string().optional(),
              kind: z.string(),
              source: z.string(),
              metric: z.string().min(1),
              value: z.unknown(),
              unit: z.string().optional(),
              confidence: z.number().optional(),
              tags: z.record(z.string(), z.unknown()).optional(),
              recordedAt: z.string().datetime().optional(),
            })).min(1).max(5000),
          }),
        },
      },
    },
  },
  responses: { 200: { description: 'Batch result' } },
})

ingestApp.openapi(batchRoute, async (c) => {
  const input = c.req.valid('json')
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

      await db.insert(events).values({
        patientId: event.patientId,
        sessionId: event.sessionId ?? null,
        pinCode: event.pinCode ?? null,
        kind: event.kind,
        source: event.source,
        metric: event.metric,
        value: parsed.data as any,
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

  return c.json(results)
})

export { ingestApp }
