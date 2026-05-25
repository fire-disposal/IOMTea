import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { successSchema } from '@iomtea/shared-types'
import { eq } from 'drizzle-orm'
import { db } from '../core/db'
import { patients } from '../core/db/schema'
import { jwtAuth } from '../middleware/auth'

const homeGraphApp = new OpenAPIHono()
homeGraphApp.use('*', jwtAuth)

const getRoute = createRoute({
  method: 'get',
  path: '/patients/:id/home-graph',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ homeGraph: z.unknown().nullable() }) } },
      description: 'Home graph',
    },
    404: { description: 'Not found' },
  },
})

homeGraphApp.openapi(getRoute, async (c) => {
  const patientId = c.req.param('id')
  const [patient] = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1)
  if (!patient) return c.json({ error: 'Not found' }, 404 as any)
  const tags = (patient.tags as Record<string, unknown>) || {}
  return c.json({ homeGraph: tags.homeGraph ?? null })
})

const upsertRoute = createRoute({
  method: 'put',
  path: '/patients/:id/home-graph',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            rooms: z.array(z.unknown()).optional(),
            corridors: z.array(z.unknown()).optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
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

homeGraphApp.openapi(upsertRoute, async (c) => {
  const patientId = c.req.param('id')
  const body = c.req.valid('json')
  const [patient] = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1)
  if (!patient) return c.json({ error: 'Not found' }, 404 as any)
  const existingTags = (patient.tags as Record<string, unknown>) || {}
  const newTags = { ...existingTags, homeGraph: body }
  await db
    .update(patients)
    .set({ tags: newTags } as any)
    .where(eq(patients.id, patientId))
  return c.json({ success: true })
})

export { homeGraphApp }
