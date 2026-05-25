import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { db } from '../core/db'
import { patients, events } from '../core/db/schema'
import { sql, and, gte } from 'drizzle-orm'
import { jwtAuth } from '../middleware/auth'

const dashboard = new OpenAPIHono()
dashboard.use('*', jwtAuth)

const summaryRoute = createRoute({
  method: 'get',
  path: '/summary',
  responses: { 200: { description: 'Dashboard summary' } },
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

export { dashboard }
