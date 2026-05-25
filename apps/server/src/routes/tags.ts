import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { successSchema, tagListSchema, tagResponseSchema } from '@iomtea/shared-types'
import { eq } from 'drizzle-orm'
import { db } from '../core/db'
import { patientTagLinks, patientTags } from '../core/db/schema/tag'
import { jwtAuth } from '../middleware/auth'

const tagsApp = new OpenAPIHono()
tagsApp.use('*', jwtAuth)

const listRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: { content: { 'application/json': { schema: tagListSchema } }, description: 'Tag list' },
  },
})

tagsApp.openapi(listRoute, async (c) => {
  const rows = await db.select().from(patientTags).orderBy(patientTags.createdAt)
  return c.json(rows)
})

const createTagRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(50).openapi({ example: '高血压' }),
            color: z.string().optional().openapi({ example: '#ff6b6b' }),
          }),
        },
      },
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: tagResponseSchema } }, description: 'Created' },
  },
})

tagsApp.openapi(createTagRoute, async (c) => {
  const body = c.req.valid('json')
  const [row] = await db
    .insert(patientTags)
    .values({ name: body.name, color: body.color ?? '#868e96' } as any)
    .returning()
  return c.json(row, 201 as any)
})

const deleteTagRoute = createRoute({
  method: 'delete',
  path: '/:id',
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Deleted' },
    404: { description: 'Not found' },
  },
})

tagsApp.openapi(deleteTagRoute, async (c) => {
  const id = c.req.param('id')
  await db.delete(patientTagLinks).where(eq(patientTagLinks.tagId, id))
  const [row] = await db.delete(patientTags).where(eq(patientTags.id, id)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404 as any)
  return c.json({ success: true })
})

export { tagsApp }
