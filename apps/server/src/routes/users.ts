import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { userResponseSchema } from '@iomtea/shared-types'
import { eq } from 'drizzle-orm'
import { db } from '../core/db'
import { users } from '../core/db/schema'
import { jwtAuth } from '../middleware/auth'

const usersApp = new OpenAPIHono()
usersApp.use('*', jwtAuth)

const listRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(userResponseSchema) } },
      description: 'User list',
    },
  },
})

usersApp.openapi(listRoute, async (c) => {
  const rows = await db.select().from(users)
  const safe = rows.map(({ passwordHash, ...rest }) => rest)
  return c.json(safe)
})

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  responses: {
    200: {
      content: { 'application/json': { schema: userResponseSchema } },
      description: 'Current user',
    },
    404: { description: 'Not found' },
  },
})

usersApp.openapi(meRoute, async (c) => {
  const userId = (c as any).get('userId') as string
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return c.json({ error: 'Not found' }, 404 as any)
  const { passwordHash, ...safe } = user
  return c.json(safe)
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/:id',
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

usersApp.openapi(updateRoute, async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const [updated] = await db
    .update(users)
    .set(body as any)
    .where(eq(users.id, id))
    .returning()
  if (!updated) return c.json({ error: 'Not found' }, 404 as any)
  const { passwordHash, ...safe } = updated
  return c.json(safe)
})

export { usersApp }
