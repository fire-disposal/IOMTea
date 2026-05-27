import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { successSchema } from '@iomtea/shared-types'
import { eq } from 'drizzle-orm'
import { db } from '../core/db'
import { alertRules } from '../core/db/schema'
import type { AppEnv } from '../core/http/types'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const alertRulesRouter = new OpenAPIHono<AppEnv>()

const getRulesRoute = createRoute({
  method: 'get',
  path: '/patients/:id/alert-rules',
  middleware: [jwtAuth, requirePermission('/alert-rules', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(z.unknown()) } },
      description: 'Alert rules for patient',
    },
    404: { description: 'Not found' },
  },
})

alertRulesRouter.openapi(getRulesRoute, async (c) => {
  const patientId = c.req.param('id')
  const [patient] = await db
    .select({ tags: patients.tags })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1)

  if (!patient) throw new HTTPException(404)

  const tags = (patient.tags as Record<string, unknown>) || {}
  const customThresholds = (tags.customThresholds as any[]) || []

  const defaults = getDefaultThresholds()

  const merged = defaults.map((d: any) => {
    const custom = customThresholds.find((c: any) => c.metric === d.metric)
    return custom || d
  })

  return c.json(merged)
})

const upsertRulesRoute = createRoute({
  method: 'put',
  path: '/patients/:id/alert-rules',
  middleware: [jwtAuth, requirePermission('/alert-rules', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            rules: z.array(ruleSchema),
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

alertRulesRouter.openapi(upsertRulesRoute, async (c) => {
  const patientId = c.req.param('id')
  const body = c.req.valid('json')

  const [patient] = await db
    .select({ tags: patients.tags })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1)

  if (!patient) throw new HTTPException(404)

  const currentTags = (patient.tags as Record<string, unknown>) || {}
  const newTags = { ...currentTags, customThresholds: body.rules }

  await db
    .update(patients)
    .set({ tags: newTags } as any)
    .where(eq(patients.id, patientId))

  return c.json({ success: true })
})

export { alertRulesRouter }
