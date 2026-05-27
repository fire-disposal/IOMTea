import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { FormDefinitionSchema } from '@iomtea/shared-types'
import { and, eq } from 'drizzle-orm'
import { db } from '../core/db'
import { formDefinitions, formResponses } from '../core/db/schema/ema'
import type { AppEnv } from '../core/http/types'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const emaApp = new OpenAPIHono<AppEnv>()

const listFormsRoute = createRoute({
  method: 'get',
  path: '/',
  middleware: [jwtAuth, requirePermission('/forms', 'read')] as const,
  responses: { 200: { description: 'All form definitions' } },
})
emaApp.openapi(listFormsRoute, async (c) => {
  const rows = await db.select().from(formDefinitions).orderBy(formDefinitions.updatedAt)
  return c.json(rows)
})

const createFormRoute = createRoute({
  method: 'post',
  path: '/',
  middleware: [jwtAuth, requirePermission('/forms', 'write')] as const,
  request: { body: { content: { 'application/json': { schema: FormDefinitionSchema } } } },
  responses: { 201: { description: 'Form created' } },
})
emaApp.openapi(createFormRoute, async (c) => {
  const body = c.req.valid('json')
  const [row] = await db
    .insert(formDefinitions)
    .values({
      code: body.code,
      title: body.title,
      description: body.description,
      cron: body.cron,
      fields: body.fields as any,
      status: 'draft',
    })
    .returning()
  return c.json(row, 201)
})

const getFormRoute = createRoute({
  method: 'get',
  path: '/:code',
  middleware: [jwtAuth, requirePermission('/forms', 'read')] as const,
  responses: { 200: { description: 'Form definition' }, 404: { description: 'Not found' } },
})
emaApp.openapi(getFormRoute, async (c) => {
  const code = c.req.param('code')
  const [form] = await db
    .select()
    .from(formDefinitions)
    .where(eq(formDefinitions.code, code))
    .limit(1)
  if (!form) return c.json({ error: 'Not found' }, 404)
  return c.json(form)
})

const updateFormRoute = createRoute({
  method: 'patch',
  path: '/:code',
  middleware: [jwtAuth, requirePermission('/forms', 'write')] as const,
  request: {
    body: { content: { 'application/json': { schema: FormDefinitionSchema.partial() } } },
  },
  responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
})
emaApp.openapi(updateFormRoute, async (c) => {
  const code = c.req.param('code')
  const body = c.req.valid('json')
  const updateData: Record<string, unknown> = {}
  if (body.title !== undefined) updateData.title = body.title
  if (body.description !== undefined) updateData.description = body.description
  if (body.cron !== undefined) updateData.cron = body.cron
  if (body.fields !== undefined) updateData.fields = body.fields
  const [row] = await db
    .update(formDefinitions)
    .set(updateData as any)
    .where(eq(formDefinitions.code, code))
    .returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

const publishFormRoute = createRoute({
  method: 'post',
  path: '/:code/publish',
  middleware: [jwtAuth, requirePermission('/forms', 'write')] as const,
  responses: { 200: { description: 'Published' } },
})
emaApp.openapi(publishFormRoute, async (c) => {
  const code = c.req.param('code')
  const [form] = await db
    .update(formDefinitions)
    .set({ status: 'published' } as any)
    .where(eq(formDefinitions.code, code))
    .returning()
  if (!form) return c.json({ error: 'Not found' }, 404)
  return c.json({ success: true, form })
})

const unpublishRoute = createRoute({
  method: 'post',
  path: '/:code/unpublish',
  middleware: [jwtAuth, requirePermission('/forms', 'write')] as const,
  responses: { 200: { description: 'Unpublished' } },
})
emaApp.openapi(unpublishRoute, async (c) => {
  const code = c.req.param('code')
  const [form] = await db
    .update(formDefinitions)
    .set({ status: 'draft' } as any)
    .where(eq(formDefinitions.code, code))
    .returning()
  if (!form) return c.json({ error: 'Not found' }, 404)
  return c.json({ success: true })
})

const respondRoute = createRoute({
  method: 'post',
  path: '/:code/respond',
  middleware: [jwtAuth, requirePermission('/forms', 'read')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            patientId: z.string().uuid(),
            responses: z.record(z.string(), z.unknown()),
          }),
        },
      },
    },
  },
  responses: { 201: { description: 'Response submitted' } },
})
emaApp.openapi(respondRoute, async (c) => {
  const code = c.req.param('code')
  const body = c.req.valid('json')
  const userId = c.var.userId

  const [form] = await db
    .select()
    .from(formDefinitions)
    .where(eq(formDefinitions.code, code))
    .limit(1)
  if (!form) return c.json({ error: 'Form not found' }, 404)

  const [resp] = await db
    .insert(formResponses)
    .values({
      formCode: code,
      patientId: body.patientId,
      userId,
      responses: body.responses as any,
    })
    .returning()

  return c.json(resp, 201)
})

const listResponsesRoute = createRoute({
  method: 'get',
  path: '/:code/responses',
  middleware: [jwtAuth, requirePermission('/forms', 'read')] as const,
  request: { query: z.object({ patientId: z.string().uuid().optional() }) },
  responses: { 200: { description: 'Form responses' } },
})
emaApp.openapi(listResponsesRoute, async (c) => {
  const code = c.req.param('code')
  const { patientId } = c.req.valid('query')
  const conds = [eq(formResponses.formCode, code)]
  if (patientId) conds.push(eq(formResponses.patientId, patientId))
  const rows = await db
    .select()
    .from(formResponses)
    .where(and(...conds))
    .orderBy(formResponses.submittedAt)
  return c.json(rows)
})

export { emaApp }
