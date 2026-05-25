import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { db } from '../core/db'
import { patients } from '../core/db/schema'
import { eq } from 'drizzle-orm'
import { listProfiles, getProfile, createSimulation, deleteSimulation, toggleSimulation, setSpeed, addPatient, removePatient, getSimulations, getSimulation, toggleMetric, updateMetric, renameSim, injectScenario } from '../modules/twin'
import { jwtAuth } from '../middleware/auth'

const twinApp = new OpenAPIHono()
twinApp.use('*', jwtAuth)

const profListRoute = createRoute({
  method: 'get', path: '/profiles',
  responses: { 200: { description: 'Profile list' } },
})
twinApp.openapi(profListRoute, async (c) => c.json(listProfiles()))

const profDetailRoute = createRoute({
  method: 'get', path: '/profiles/:name',
  responses: { 200: { description: 'Profile config' } },
})
twinApp.openapi(profDetailRoute, async (c) => {
  const config = getProfile(c.req.param('name'))
  if (!config) return c.json({ error: 'Not found' }, 404 as any)
  return c.json(config)
})

const simListRoute = createRoute({
  method: 'get', path: '/simulations',
  responses: { 200: { description: 'Simulation list' } },
})
twinApp.openapi(simListRoute, async (c) => c.json(getSimulations()))

const simDetailRoute = createRoute({
  method: 'get', path: '/simulations/:id',
  responses: { 200: { description: 'Simulation detail' } },
})
twinApp.openapi(simDetailRoute, async (c) => {
  const sim = getSimulation(c.req.param('id'))
  if (!sim) return c.json({ error: 'Not found' }, 404 as any)
  return c.json(sim)
})

const simCreateRoute = createRoute({
  method: 'post', path: '/simulations',
  request: {
    body: { content: { 'application/json': { schema: z.object({
      profile: z.string().openapi({ example: 'elderly-cardiac' }),
      name: z.string().optional(),
    }) } } },
  },
  responses: { 201: { description: 'Created' } },
})
twinApp.openapi(simCreateRoute, async (c) => {
  const body = c.req.valid('json')
  const sim = await createSimulation(db, { profileName: body.profile, name: body.name ?? body.profile })
  return c.json(sim, 201 as any)
})

const simDeleteRoute = createRoute({
  method: 'delete', path: '/simulations/:id',
  responses: { 200: { description: 'Deleted' } },
})
twinApp.openapi(simDeleteRoute, async (c) => {
  await deleteSimulation(db, c.req.param('id'))
  return c.json({ success: true })
})

const simToggleRoute = createRoute({
  method: 'post', path: '/simulations/:id/toggle',
  request: {
    body: { content: { 'application/json': { schema: z.object({
      running: z.boolean(),
    }) } } },
  },
  responses: { 200: { description: 'Toggled' } },
})
twinApp.openapi(simToggleRoute, async (c) => {
  const body = c.req.valid('json')
  await toggleSimulation(db, c.req.param('id'), body.running)
  return c.json({ success: true })
})

const simRenameRoute = createRoute({
  method: 'patch', path: '/simulations/:id/rename',
  request: {
    body: { content: { 'application/json': { schema: z.object({
      name: z.string(),
    }) } } },
  },
  responses: { 200: { description: 'Renamed' } },
})
twinApp.openapi(simRenameRoute, async (c) => {
  const body = c.req.valid('json')
  await renameSim(db, c.req.param('id'), body.name)
  return c.json({ success: true })
})

const simMetricToggleRoute = createRoute({
  method: 'post', path: '/simulations/:id/metrics/:metricName/toggle',
  request: {
    body: { content: { 'application/json': { schema: z.object({
      enabled: z.boolean(),
    }) } } },
  },
  responses: { 200: { description: 'Toggled' } },
})
twinApp.openapi(simMetricToggleRoute, async (c) => {
  const body = c.req.valid('json')
  await toggleMetric(db, c.req.param('id'), c.req.param('metricName'), body.enabled)
  return c.json({ success: true })
})

const simMetricUpdateRoute = createRoute({
  method: 'patch', path: '/simulations/:id/metrics/:metricName',
  request: {
    body: { content: { 'application/json': { schema: z.object({
      intervalMin: z.number().optional(),
      intervalMax: z.number().optional(),
      jitter: z.number().optional(),
    }) } } },
  },
  responses: { 200: { description: 'Updated' } },
})
twinApp.openapi(simMetricUpdateRoute, async (c) => {
  const body = c.req.valid('json')
  await updateMetric(db, c.req.param('id'), c.req.param('metricName'), body)
  return c.json({ success: true })
})

const simAddPatientRoute = createRoute({
  method: 'post', path: '/simulations/:id/patients',
  request: {
    body: { content: { 'application/json': { schema: z.object({
      patientId: z.string().uuid(),
    }) } } },
  },
  responses: { 201: { description: 'Added' } },
})
twinApp.openapi(simAddPatientRoute, async (c) => {
  const body = c.req.valid('json')
  const patientId = body.patientId
  const patientName = (await db.select().from(patients).where(eq(patients.id, patientId)).limit(1))[0]?.name ?? patientId
  await addPatient(db, c.req.param('id'), { id: patientId, name: patientName })
  return c.json({ success: true }, 201 as any)
})

const simRemovePatientRoute = createRoute({
  method: 'delete', path: '/simulations/:id/patients/:patientId',
  responses: { 200: { description: 'Removed' } },
})
twinApp.openapi(simRemovePatientRoute, async (c) => {
  await removePatient(db, c.req.param('id'), c.req.param('patientId'))
  return c.json({ success: true })
})

const speedRoute = createRoute({
  method: 'patch', path: '/speed',
  request: {
    body: { content: { 'application/json': { schema: z.object({
      speed: z.number().min(0.1).max(100),
    }) } } },
  },
  responses: { 200: { description: 'Speed set' } },
})
twinApp.openapi(speedRoute, async (c) => {
  const body = c.req.valid('json')
  setSpeed(body.speed)
  return c.json({ speed: body.speed })
})

const scenarioRoute = createRoute({
  method: 'post', path: '/simulations/:id/patients/:patientId/scenario',
  request: {
    body: { content: { 'application/json': { schema: z.object({
      type: z.string().openapi({ example: 'tachycardia' }),
    }) } } },
  },
  responses: { 200: { description: 'Scenario injected' } },
})
twinApp.openapi(scenarioRoute, async (c) => {
  const body = c.req.valid('json')
  await injectScenario(db, c.req.param('id'), c.req.param('patientId'), body.type)
  return c.json({ success: true })
})

export { twinApp }
