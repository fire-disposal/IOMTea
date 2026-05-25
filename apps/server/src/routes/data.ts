import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { metricResponseSchema } from '@iomtea/shared-types'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../core/db'
import { events } from '../core/db/schema'
import { truncExpr, valueExpression } from '../core/pipeline/query-helpers'
import { getMetricOrDefault, listMetrics } from '../core/pipeline/registry'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const dataApp = new OpenAPIHono()

const metricsRoute = createRoute({
  method: 'get',
  path: '/metrics',
  middleware: [jwtAuth, requirePermission('/data', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(metricResponseSchema) } },
      description: 'Metric list',
    },
  },
})

dataApp.openapi(metricsRoute, async (c) => {
  return c.json(
    listMetrics().map((m) => ({
      metric: m.metric,
      displayName: m.displayName,
      unit: m.unit,
      valueType: m.valueType,
      fields: m.fields,
      defaultChart: m.defaultChart,
      category: m.category,
      normalRange: m.normalRange,
    })),
  )
})

const rawRoute = createRoute({
  method: 'get',
  path: '/raw',
  middleware: [jwtAuth, requirePermission('/data', 'read')] as const,
  request: {
    query: z.object({
      patientId: z.string().uuid(),
      metric: z.string().min(1),
      fieldPath: z.string().optional(),
      from: z.string().datetime(),
      to: z.string().datetime().optional(),
      limit: z.coerce.number().min(1).max(10000).default(200),
      offset: z.coerce.number().min(0).default(0),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ metric: z.string(), rows: z.array(z.unknown()) }),
        },
      },
      description: 'Raw time series',
    },
  },
})

dataApp.openapi(rawRoute, async (c) => {
  const q = c.req.valid('query')
  const def = getMetricOrDefault(q.metric)
  const valExpr = valueExpression(def, q.fieldPath)

  const conditions = [eq(events.patientId, q.patientId), eq(events.metric, q.metric)]
  conditions.push(gte(events.recordedAt, new Date(q.from)))
  if (q.to) conditions.push(lte(events.recordedAt, new Date(q.to)))

  const rows = await db
    .select({
      id: events.id,
      patientId: events.patientId,
      recordedAt: events.recordedAt,
      value: events.value,
      numericValue: valExpr.mapWith(Number),
      unit: events.unit,
      tags: events.tags,
      source: events.source,
      kind: events.kind,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(desc(events.recordedAt))
    .limit(q.limit)
    .offset(q.offset)

  return c.json({
    metric: q.metric,
    fieldPath: q.fieldPath,
    unit: def.unit,
    rows: rows.reverse().map((r) => ({
      recordedAt: r.recordedAt?.getTime(),
      value: r.value,
      numericValue: r.numericValue,
      unit: r.unit,
      tags: r.tags,
      source: r.source,
      kind: r.kind,
    })),
  })
})

const aggregateRoute = createRoute({
  method: 'get',
  path: '/aggregate',
  middleware: [jwtAuth, requirePermission('/data', 'read')] as const,
  request: {
    query: z.object({
      patientId: z.string().uuid(),
      metric: z.string().min(1),
      fieldPath: z.string().optional(),
      from: z.string().datetime(),
      to: z.string().datetime().optional(),
      interval: z.enum(['minute', 'hour', 'day', 'week']).default('day'),
      fn: z.enum(['avg', 'min', 'max', 'count']).default('avg'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ metric: z.string(), rows: z.array(z.unknown()) }),
        },
      },
      description: 'Aggregated time series',
    },
  },
})

dataApp.openapi(aggregateRoute, async (c) => {
  const q = c.req.valid('query')
  const def = getMetricOrDefault(q.metric)
  const valExpr = valueExpression(def, q.fieldPath)
  const timeBucket = truncExpr(q.interval)

  const conditions = [eq(events.patientId, q.patientId), eq(events.metric, q.metric)]
  conditions.push(gte(events.recordedAt, new Date(q.from)))
  if (q.to) conditions.push(lte(events.recordedAt, new Date(q.to)))

  let aggFn: ReturnType<typeof sql>
  if (q.fn === 'count') aggFn = sql`count(${valExpr})`
  else if (q.fn === 'min') aggFn = sql`min(${valExpr})`
  else if (q.fn === 'max') aggFn = sql`max(${valExpr})`
  else aggFn = sql`avg(${valExpr})`

  const rows = await db
    .select({
      bucket: timeBucket.mapWith((v: unknown) => String(v)),
      value: aggFn.mapWith(Number),
    })
    .from(events)
    .where(and(...conditions))
    .groupBy(timeBucket)
    .orderBy(asc(timeBucket))

  return c.json({
    metric: q.metric,
    fieldPath: q.fieldPath,
    interval: q.interval,
    fn: q.fn,
    unit: def.unit,
    rows,
  })
})

const latestRoute = createRoute({
  method: 'get',
  path: '/latest',
  middleware: [jwtAuth, requirePermission('/data', 'read')] as const,
  request: { query: z.object({ patientId: z.string().uuid() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(z.unknown()) } },
      description: 'Latest values',
    },
  },
})

dataApp.openapi(latestRoute, async (c) => {
  const q = c.req.valid('query')
  const rows = await db
    .selectDistinctOn([events.metric], {
      metric: events.metric,
      value: events.value,
      unit: events.unit,
      recordedAt: events.recordedAt,
      tags: events.tags,
    })
    .from(events)
    .where(and(eq(events.patientId, q.patientId), sql`${events.kind} = 'observation'`))
    .orderBy(events.metric, desc(events.recordedAt))

  return c.json(
    rows.map((r) => ({
      metric: r.metric,
      value: r.value,
      unit: r.unit,
      recordedAt: r.recordedAt?.getTime(),
      tags: r.tags,
    })),
  )
})

export { dataApp }
