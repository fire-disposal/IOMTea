import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { alertListSchema, alertResponseSchema, successSchema } from '@iomtea/shared-types'
import { and, desc, eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { db } from '../core/db'
import { events } from '../core/db/schema'
import type { AppEnv } from '../core/http/types'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const alertsRouter = new OpenAPIHono<AppEnv>()

const listAlertsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Alerts'],
  middleware: [jwtAuth, requirePermission('/alerts', 'read')] as const,
  request: {
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      pageSize: z.coerce.number().min(1).max(200).default(50),
      patientId: z.string().uuid().optional(),
      severity: z.string().optional(),
      status: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: alertListSchema } },
      description: 'Alert list',
    },
  },
})

alertsRouter.openapi(listAlertsRoute, async (c) => {
  const q = c.req.valid('query')
  const conditions = [eq(events.kind, 'alert')]
  if (q.patientId) conditions.push(eq(events.patientId, q.patientId))
  if (q.severity) conditions.push(eq(events.severity, q.severity as any))
  if (q.status) conditions.push(eq(events.status, q.status as any))

  const rows = await db
    .select()
    .from(events)
    .where(and(...conditions))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize)
    .orderBy(desc(events.recordedAt))

  return c.json(rows)
})

const getAlertRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Alerts'],
  middleware: [jwtAuth, requirePermission('/alerts', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: alertResponseSchema } },
      description: 'Alert detail',
    },
    404: { description: 'Not found' },
  },
})

alertsRouter.openapi(getAlertRoute, async (c) => {
  const id = c.req.param('id')
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.kind, 'alert')))
    .limit(1)
  if (!row) throw new HTTPException(404)
  return c.json(row)
})

const updateAlertRoute = createRoute({
  method: 'patch',
  path: '/:id',
  tags: ['Alerts'],
  middleware: [jwtAuth, requirePermission('/alerts', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            action: z.enum(['acknowledge', 'resolve', 'assign']),
            assigneeId: z.string().uuid().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Updated' },
    404: { description: 'Not found' },
  },
})

alertsRouter.openapi(updateAlertRoute, async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const [alert] = await db
    .select({ tags: events.tags })
    .from(events)
    .where(and(eq(events.id, id), eq(events.kind, 'alert')))
    .limit(1)
  if (!alert) throw new HTTPException(404)

  const tags = { ...((alert.tags as Record<string, unknown>) || {}) }
  const updateData: Record<string, unknown> = {}

  if (body.action === 'acknowledge') {
    updateData.status = 'acknowledged'
    tags.acknowledged_at = new Date().toISOString()
  } else if (body.action === 'resolve') {
    updateData.status = 'resolved'
    tags.resolved_at = new Date().toISOString()
  } else if (body.action === 'assign') {
    updateData.status = 'assigned'
    if (body.assigneeId) tags.assigned_to = body.assigneeId
    tags.assigned_at = new Date().toISOString()
  }
  updateData.tags = tags

  const [updated] = await db
    .update(events)
    .set(updateData as any)
    .where(and(eq(events.id, id), eq(events.kind, 'alert')))
    .returning()
  if (!updated) throw new HTTPException(404)
  return c.json(updated)
})

const closeAlertRoute = createRoute({
  method: 'post',
  path: '/:id/close',
  tags: ['Alerts'],
  middleware: [jwtAuth, requirePermission('/alerts', 'write')] as const,
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Closed' },
    404: { description: 'Not found' },
  },
})

alertsRouter.openapi(closeAlertRoute, async (c) => {
  const id = c.req.param('id')

  const [alert] = await db
    .select({ tags: events.tags })
    .from(events)
    .where(and(eq(events.id, id), eq(events.kind, 'alert')))
    .limit(1)
  if (!alert) throw new HTTPException(404)

  const tags = { ...((alert.tags as Record<string, unknown>) || {}) }
  tags.closed_at = new Date().toISOString()

  const [updated] = await db
    .update(events)
    .set({ status: 'closed', tags } as any)
    .where(and(eq(events.id, id), eq(events.kind, 'alert')))
    .returning()
  if (!updated) throw new HTTPException(404)
  return c.json(updated)
})

export { alertsRouter }
