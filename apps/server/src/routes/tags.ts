import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { successSchema, tagListSchema, tagResponseSchema } from '@iomtea/shared-types'
import { eq } from 'drizzle-orm'
import { db } from '../core/db'
import { patientTags, patientTagLinks } from '../core/db/schema/tag'
import type { AppEnv } from '../core/http/types'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const tagsApp = new OpenAPIHono<AppEnv>()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  middleware: [jwtAuth, requirePermission('/tags', 'read')] as const,
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
  middleware: [jwtAuth, requirePermission('/tags', 'write')] as const,
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
  return c.json(row, 201)
})

const deleteTagRoute = createRoute({
  method: 'delete',
  path: '/:id',
  middleware: [jwtAuth, requirePermission('/tags', 'write')] as const,
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Deleted' },
    404: { description: 'Not found' },
  },
})

tagsApp.openapi(deleteTagRoute, async (c) => {
  const id = c.req.param('id')
  await db.delete(patientTagLinks).where(eq(patientTagLinks.tagId, id))
  const [row] = await db.delete(patientTags).where(eq(patientTags.id, id)).returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json({ success: true })
})

const getTagRoute = createRoute({
  method: 'get',
  path: '/:id',
  middleware: [jwtAuth, requirePermission('/tags', 'read')] as const,
  responses: { 200: { description: 'Tag detail' }, 404: { description: 'Not found' } },
})

tagsApp.openapi(getTagRoute, async (c) => {
  const id = c.req.param('id')
  const [tag] = await db.select().from(patientTags).where(eq(patientTags.id, id)).limit(1)
  if (!tag) return c.json({ error: 'Not found' }, 404)
  return c.json(tag)
})

const updateTagRoute = createRoute({
  method: 'patch',
  path: '/:id',
  middleware: [jwtAuth, requirePermission('/tags', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(50).optional(),
            color: z
              .string()
              .regex(/^#[0-9a-fA-F]{6}$/)
              .optional(),
          }),
        },
      },
    },
  },
  responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
})

tagsApp.openapi(updateTagRoute, async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const [tag] = await db
    .update(patientTags)
    .set(body as any)
    .where(eq(patientTags.id, id))
    .returning()
  if (!tag) return c.json({ error: 'Not found' }, 404)
  return c.json(tag)
})

export { tagsApp }
