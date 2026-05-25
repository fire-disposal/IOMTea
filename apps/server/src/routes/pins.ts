import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { pinListSchema, pinResponseSchema, successSchema } from '@iomtea/shared-types'
import { eq } from 'drizzle-orm'
import { db } from '../core/db'
import { usersPin } from '../core/db/schema/pin'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const pinsApp = new OpenAPIHono()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  middleware: [jwtAuth, requirePermission('/pins', 'read')] as const,
  responses: {
    200: { content: { 'application/json': { schema: pinListSchema } }, description: 'PIN list' },
  },
})

pinsApp.openapi(listRoute, async (c) => {
  const rows = await db.select().from(usersPin).orderBy(usersPin.createdAt)
  return c.json(rows)
})

const createPinRoute = createRoute({
  method: 'post',
  path: '/',
  middleware: [jwtAuth, requirePermission('/pins', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            pin: z.string().length(6).optional().openapi({ example: '123456' }),
            userId: z.string().uuid(),
            type: z.enum(['device', 'virtual', 'user', 'simulator']).default('device'),
            label: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: pinResponseSchema } }, description: 'Created' },
  },
})

pinsApp.openapi(createPinRoute, async (c) => {
  const body = c.req.valid('json')
  const pin = body.pin || String(Math.floor(100000 + Math.random() * 900000))
  const [row] = await db
    .insert(usersPin)
    .values({ pin, userId: body.userId, type: body.type, label: body.label ?? null } as any)
    .returning()
  return c.json(row, 201 as any)
})

const revokePinRoute = createRoute({
  method: 'delete',
  path: '/:code',
  middleware: [jwtAuth, requirePermission('/pins', 'write')] as const,
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Revoked' },
    404: { description: 'Not found' },
  },
})

pinsApp.openapi(revokePinRoute, async (c) => {
  const code = c.req.param('code')
  const [row] = await db.delete(usersPin).where(eq(usersPin.pin, code)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404 as any)
  return c.json({ success: true })
})

const getPinRoute = createRoute({
  method: 'get',
  path: '/:code',
  middleware: [jwtAuth, requirePermission('/pins', 'read')] as const,
  responses: { 200: { description: 'PIN detail' }, 404: { description: 'Not found' } },
})

pinsApp.openapi(getPinRoute, async (c) => {
  const code = c.req.param('code')
  const [pin] = await db.select().from(usersPin).where(eq(usersPin.pin, code)).limit(1)
  if (!pin) return c.json({ error: 'Not found' }, 404 as any)
  return c.json(pin)
})

const updatePinRoute = createRoute({
  method: 'patch',
  path: '/:code',
  middleware: [jwtAuth, requirePermission('/pins', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            label: z.string().max(100).optional(),
            pinType: z.enum(['device', 'virtual', 'user', 'simulator']).optional(),
          }),
        },
      },
    },
  },
  responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
})

pinsApp.openapi(updatePinRoute, async (c) => {
  const code = c.req.param('code')
  const body = c.req.valid('json')
  const updateData: Record<string, unknown> = {}
  if (body.label !== undefined) updateData.label = body.label
  if (body.pinType !== undefined) updateData.type = body.pinType
  const [pin] = await db.update(usersPin).set(updateData as any).where(eq(usersPin.pin, code)).returning()
  if (!pin) return c.json({ error: 'Not found' }, 404 as any)
  return c.json(pin)
})

export { pinsApp }
