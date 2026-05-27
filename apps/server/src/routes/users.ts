import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { userResponseSchema } from '@iomtea/shared-types'
import { eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { db } from '../core/db'
import { users } from '../core/db/schema'
import type { AppEnv } from '../core/http/types'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const usersRouter = new OpenAPIHono<AppEnv>()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  middleware: [jwtAuth, requirePermission('/users', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(userResponseSchema) } },
      description: 'User list',
    },
  },
})

usersRouter.openapi(listRoute, async (c) => {
  const rows = await db.select().from(users)
  const safe = rows.map(({ passwordHash, ...rest }) => rest)
  return c.json(safe)
})

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  middleware: [jwtAuth, requirePermission('/users', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: userResponseSchema } },
      description: 'Current user',
    },
    404: { description: 'Not found' },
  },
})

usersRouter.openapi(meRoute, async (c) => {
  const userId = c.var.userId
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new HTTPException(404)
  const { passwordHash, ...safe } = user
  return c.json(safe)
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/:id',
  middleware: [jwtAuth, requirePermission('/users', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            displayName: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: userResponseSchema } },
      description: 'Updated',
    },
    404: { description: 'Not found' },
  },
})

usersRouter.openapi(updateRoute, async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const [updated] = await db
    .update(users)
    .set(body as any)
    .where(eq(users.id, id))
    .returning()
  if (!updated) throw new HTTPException(404)
  const { passwordHash, ...safe } = updated
  return c.json(safe)
})

const getUserRoute = createRoute({
  method: 'get',
  path: '/:id',
  middleware: [jwtAuth, requirePermission('/users', 'read')] as const,
  responses: { 200: { description: 'User detail' }, 404: { description: 'Not found' } },
})

usersRouter.openapi(getUserRoute, async (c) => {
  const id = c.req.param('id')
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
      credit: users.credit,
      phone: users.phone,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  if (!user) throw new HTTPException(404)
  return c.json(user)
})

const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/:id',
  middleware: [jwtAuth, requirePermission('/users', 'delete')] as const,
  responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } },
})

usersRouter.openapi(deleteUserRoute, async (c) => {
  const id = c.req.param('id')
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1)
  if (!existing) throw new HTTPException(404)
  await db.delete(users).where(eq(users.id, id))
  return c.json({ success: true })
})

const updateRoleRoute = createRoute({
  method: 'patch',
  path: '/:id/role',
  middleware: [jwtAuth, requirePermission('/users', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ role: z.enum(['super_admin', 'admin', 'user']) }),
        },
      },
    },
  },
  responses: { 200: { description: 'Role updated' }, 404: { description: 'Not found' } },
})

usersRouter.openapi(updateRoleRoute, async (c) => {
  const id = c.req.param('id')
  const { role } = c.req.valid('json')
  const [user] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, id))
    .returning({ id: users.id, role: users.role })
  if (!user) throw new HTTPException(404)
  return c.json(user)
})

export { usersRouter }
