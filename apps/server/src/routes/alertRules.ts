import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { db } from '../core/db'
import { patients } from '../core/db/schema'
import { eq } from 'drizzle-orm'
import { jwtAuth } from '../middleware/auth'
import { DEFAULT_THRESHOLDS } from '../core/trpc/routers/thresholds'

const ruleSchema = z.object({
  metric: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
  enabled: z.boolean().default(true),
  label: z.string().optional(),
  unit: z.string().optional(),
})

const alertRulesApp = new OpenAPIHono()
alertRulesApp.use('*', jwtAuth)

const getRulesRoute = createRoute({
  method: 'get',
  path: '/patients/:id/alert-rules',
  responses: { 200: { description: 'Alert rules for patient' }, 404: { description: 'Not found' } },
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
  const customThresholds = (tags.customThresholds as z.infer<typeof ruleSchema>[]) || []
  const profileId = (tags.profileId as string) || ''

  const defaults =
    profileId && profileId in DEFAULT_THRESHOLDS
      ? DEFAULT_THRESHOLDS[profileId as keyof typeof DEFAULT_THRESHOLDS]
      : []

  const merged = defaults.map((d) => {
    const custom = customThresholds.find(
      (c: z.infer<typeof ruleSchema>) => c.metric === d.metric,
    )
    return custom || d
  })

  return c.json(merged)
})

const upsertRulesRoute = createRoute({
  method: 'put',
  path: '/patients/:id/alert-rules',
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
  responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
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

  await db.update(patients).set({ tags: newTags } as any).where(eq(patients.id, patientId))

  return c.json({ success: true })
})

export { alertRulesApp }
