import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { dashboardResponseSchema } from '@iomtea/shared-types'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '../core/db'
import { events, patients } from '../core/db/schema'
import type { AppEnv } from '../core/http/types'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const dashboard = new OpenAPIHono<AppEnv>()

const summaryRoute = createRoute({
  method: 'get',
  path: '/summary',
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: dashboardResponseSchema } },
      description: 'Dashboard summary',
    },
  },
})

dashboard.openapi(summaryRoute, async (c) => {
  const [patientCount] = await db
    .select({ count: sql`count(*)::int`.mapWith(Number) })
    .from(patients)

  const dayAgo = new Date(Date.now() - 86400000)
  const [activeAlerts] = await db
    .select({ count: sql`count(*)::int`.mapWith(Number) })
    .from(events)
    .where(and(sql`${events.kind} = 'alert'`, gte(events.recordedAt, dayAgo)))

  const [criticalAlerts] = await db
    .select({ count: sql`count(*)::int`.mapWith(Number) })
    .from(events)
    .where(and(sql`${events.kind} = 'alert'`, sql`${events.severity} = 'critical'`))

  return c.json({
    patientCount: patientCount?.count ?? 0,
    activeAlerts24h: activeAlerts?.count ?? 0,
    criticalAlerts: criticalAlerts?.count ?? 0,
  })
})

const trendsRoute = createRoute({
  method: 'get',
  path: '/trends',
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  request: {
    query: z.object({
      days: z.coerce.number().min(1).max(30).default(7),
    }),
  },
  responses: { 200: { description: 'Alert trend data' } },
})

dashboard.openapi(trendsRoute, async (c) => {
  const { days } = c.req.valid('query')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      day: sql`date(${events.recordedAt})`.mapWith(String),
      count: sql`count(*)::int`.mapWith(Number),
    })
    .from(events)
    .where(and(eq(events.kind, 'alert'), gte(events.recordedAt, since)))
    .groupBy(sql`date(${events.recordedAt})`)
    .orderBy(sql`date(${events.recordedAt})`)

  return c.json(rows)
})

const patientDashboardRoute = createRoute({
  method: 'get',
  path: '/patient/:id',
  middleware: [jwtAuth, requirePermission('/dashboard', 'read')] as const,
  responses: {
    200: { description: 'Patient dashboard overview' },
    404: { description: 'Not found' },
  },
})

dashboard.openapi(patientDashboardRoute, async (c) => {
  const patientId = c.req.param('id')

  const [patient] = await db
    .select({ id: patients.id, name: patients.name, tags: patients.tags })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1)

  if (!patient) throw new HTTPException(404)

  const latestMetrics = await db
    .selectDistinctOn([events.metric], {
      metric: events.metric,
      value: events.value,
      unit: events.unit,
      recordedAt: events.recordedAt,
    })
    .from(events)
    .where(and(eq(events.patientId, patientId), eq(events.kind, 'observation')))
    .orderBy(events.metric, desc(events.recordedAt))

  const recentAlerts = await db
    .select()
    .from(events)
    .where(and(eq(events.patientId, patientId), eq(events.kind, 'alert')))
    .orderBy(desc(events.recordedAt))
    .limit(5)

  return c.json({
    patient: { id: patient.id, name: patient.name },
    latestMetrics,
    recentAlerts,
  })
})

export { dashboard }
