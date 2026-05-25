import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { successSchema } from '@iomtea/shared-types'
import { eq } from 'drizzle-orm'
import { db } from '../core/db'
import { patients } from '../core/db/schema'
import { listMetrics } from '../core/pipeline/registry'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

function getDefaultThresholds(): {
  metric: string
  min?: number
  max?: number
  enabled: boolean
  label: string
  unit: string
}[] {
  return listMetrics()
    .filter((m) => m.normalRange)
    .map((m) => ({
      metric: m.metric,
      label: m.displayName,
      unit: m.unit,
      min: m.normalRange!.min,
      max: m.normalRange!.max,
      enabled: true,
    }))
}

const ruleSchema = z.object({
  metric: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
  enabled: z.boolean().default(true),
  label: z.string().optional(),
  unit: z.string().optional(),
})

const alertRulesApp = new OpenAPIHono()

const getRulesRoute = createRoute({
  method: 'get',
  path: '/patients/:id/alert-rules',
  middleware: [jwtAuth, requirePermission('/alert-rules', 'write')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(z.unknown()) } },
      description: 'Alert rules for patient',
    },
    404: { description: 'Not found' },
  },
})

alertRulesApp.openapi(getRulesRoute, async (c) => {
  const patientId = c.req.param('id')
  const [patient] = await db
    .select({ tags: patients.tags })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1)

  if (!patient) return c.json({ error: 'Not found' }, 404 as any)

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

alertRulesApp.openapi(upsertRulesRoute, async (c) => {
  const patientId = c.req.param('id')
  const body = c.req.valid('json')

  const [patient] = await db
    .select({ tags: patients.tags })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1)

  if (!patient) return c.json({ error: 'Not found' }, 404 as any)

  const currentTags = (patient.tags as Record<string, unknown>) || {}
  const newTags = { ...currentTags, customThresholds: body.rules }

  await db
    .update(patients)
    .set({ tags: newTags } as any)
    .where(eq(patients.id, patientId))

  return c.json({ success: true })
})

export { alertRulesApp }
