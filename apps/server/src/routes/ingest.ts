import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { db } from '../core/db'
import { events, patients } from '../core/db/schema'
import type { AppEnv } from '../core/http/types'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const ingestRouter = new OpenAPIHono<AppEnv>()

const singleRoute = createRoute({
  method: 'post',
  path: '/single',
  middleware: [jwtAuth, requirePermission('/ingest', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            patientId: z
              .string()
              .uuid()
              .openapi({ example: '00000000-0000-0000-0000-000000000001' }),
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

ingestRouter.openapi(singleRoute, async (c) => {
  const input = c.req.valid('json')
  const def = getMetricOrDefault(input.metric)
  const parsed = def.valueSchema.safeParse(input.value)
  if (!parsed.success) {
    logger.warn({ metric: input.metric, errors: parsed.error.issues }, 'ingest validation failed')
    return c.json({ error: `Value validation failed: ${parsed.error.message}` }, 400)
  }

  const [row] = await db
    .insert(events)
    .values({
      patientId: input.patientId,
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

  return c.json(row, 201)
})

const batchRoute = createRoute({
  method: 'post',
  path: '/batch',
  middleware: [jwtAuth, requirePermission('/ingest', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            events: z
              .array(
                z.object({
                  patientId: z.string().uuid(),
                  pinCode: z.string().optional(),
                  kind: z.string(),
                  source: z.string(),
                  metric: z.string().min(1),
                  value: z.unknown(),
                  unit: z.string().optional(),
                  confidence: z.number().optional(),
                  tags: z.record(z.string(), z.unknown()).optional(),
                  recordedAt: z.string().datetime().optional(),
                }),
              )
              .min(1)
              .max(5000),
          }),
        },
      },
    },
  },
  responses: { 200: { description: 'Batch result' } },
})

ingestRouter.openapi(batchRoute, async (c) => {
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

export { ingestRouter }
