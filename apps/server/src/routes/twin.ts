import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import {
  profileResponseSchema,
  simulationResponseSchema,
  successSchema,
} from '@iomtea/shared-types'
import { eq } from 'drizzle-orm'
import { db } from '../core/db'
import { patients } from '../core/db/schema'
import type { AppEnv } from '../core/http/types'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import {
  addPatient,
  createSimulation,
  deleteSimulation,
  getProfile,
  getSimulation,
  getSimulations,
  injectScenario,
  listProfiles,
  removePatient,
  renameSim,
  setSpeed,
  toggleMetric,
  toggleSimulation,
  updateMetric,
} from '../modules/twin'

const twinRouter = new OpenAPIHono<AppEnv>()

const profListRoute = createRoute({
  method: 'get',
  path: '/profiles',
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(profileResponseSchema) } },
      description: 'Profile list',
    },
  },
})
twinRouter.openapi(profListRoute, async (c) => c.json(listProfiles()))

const profDetailRoute = createRoute({
  method: 'get',
  path: '/profiles/:name',
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: profileResponseSchema } },
      description: 'Profile config',
    },
    404: { description: 'Not found' },
  },
})
twinRouter.openapi(profDetailRoute, async (c) => {
  const config = getProfile(c.req.param('name'))
  if (!config) throw new HTTPException(404)
  return c.json(config)
})

const simListRoute = createRoute({
  method: 'get',
  path: '/simulations',
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(simulationResponseSchema) } },
      description: 'Simulation list',
    },
  },
})
twinRouter.openapi(simListRoute, async (c) => c.json(getSimulations()))

const simDetailRoute = createRoute({
  method: 'get',
  path: '/simulations/:id',
  middleware: [jwtAuth, requirePermission('/twin', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: simulationResponseSchema } },
      description: 'Simulation detail',
    },
    404: { description: 'Not found' },
  },
})
twinRouter.openapi(simDetailRoute, async (c) => {
  const sim = getSimulation(c.req.param('id'))
  if (!sim) throw new HTTPException(404)
  return c.json(sim)
})

const simCreateRoute = createRoute({
  method: 'post',
  path: '/simulations',
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            profile: z.string().openapi({ example: 'elderly-cardiac' }),
            name: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: simulationResponseSchema } },
      description: 'Created',
    },
    500: { description: 'Creation failed' },
  },
})
twinRouter.openapi(simCreateRoute, async (c) => {
  const body = c.req.valid('json')
  const sim = await createSimulation(db, {
    profileName: body.profile,
    name: body.name ?? body.profile,
  })
  if (!sim) return c.json({ error: 'Failed to create simulation' }, 500)
  return c.json(sim, 201)
})

const simDeleteRoute = createRoute({
  method: 'delete',
  path: '/simulations/:id',
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Deleted' },
  },
})
twinRouter.openapi(simDeleteRoute, async (c) => {
  await deleteSimulation(db, c.req.param('id'))
  return c.json({ success: true })
})

const simToggleRoute = createRoute({
  method: 'post',
  path: '/simulations/:id/toggle',
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            running: z.boolean(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Toggled' },
  },
})
twinRouter.openapi(simToggleRoute, async (c) => {
  const body = c.req.valid('json')
  await toggleSimulation(db, c.req.param('id'), body.running)
  return c.json({ success: true })
})

const simRenameRoute = createRoute({
  method: 'patch',
  path: '/simulations/:id/rename',
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Renamed' },
  },
})
twinRouter.openapi(simRenameRoute, async (c) => {
  const body = c.req.valid('json')
  await renameSim(db, c.req.param('id'), body.name)
  return c.json({ success: true })
})

const simMetricToggleRoute = createRoute({
  method: 'post',
  path: '/simulations/:id/metrics/:metricName/toggle',
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            enabled: z.boolean(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Toggled' },
  },
})
twinRouter.openapi(simMetricToggleRoute, async (c) => {
  const body = c.req.valid('json')
  await toggleMetric(db, c.req.param('id'), c.req.param('metricName'), body.enabled)
  return c.json({ success: true })
})

const simMetricUpdateRoute = createRoute({
  method: 'patch',
  path: '/simulations/:id/metrics/:metricName',
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            intervalMin: z.number().optional(),
            intervalMax: z.number().optional(),
            jitter: z.number().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Updated' },
  },
})
twinRouter.openapi(simMetricUpdateRoute, async (c) => {
  const body = c.req.valid('json')
  await updateMetric(db, c.req.param('id'), c.req.param('metricName'), body)
  return c.json({ success: true })
})

const simAddPatientRoute = createRoute({
  method: 'post',
  path: '/simulations/:id/patients',
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            patientId: z.string().uuid(),
          }),
        },
      },
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: successSchema } }, description: 'Added' },
  },
})
twinRouter.openapi(simAddPatientRoute, async (c) => {
  const body = c.req.valid('json')
  const patientId = body.patientId
  const patientName =
    (await db.select().from(patients).where(eq(patients.id, patientId)).limit(1))[0]?.name ??
    patientId
  await addPatient(db, c.req.param('id'), { id: patientId, name: patientName })
  return c.json({ success: true }, 201)
})

const simRemovePatientRoute = createRoute({
  method: 'delete',
  path: '/simulations/:id/patients/:patientId',
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Removed' },
  },
})
twinRouter.openapi(simRemovePatientRoute, async (c) => {
  await removePatient(db, c.req.param('id'), c.req.param('patientId'))
  return c.json({ success: true })
})

const speedRoute = createRoute({
  method: 'patch',
  path: '/speed',
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            speed: z.number().min(0.1).max(100),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ speed: z.number() }) } },
      description: 'Speed set',
    },
  },
})
twinRouter.openapi(speedRoute, async (c) => {
  const body = c.req.valid('json')
  setSpeed(body.speed)
  return c.json({ speed: body.speed })
})

const scenarioRoute = createRoute({
  method: 'post',
  path: '/simulations/:id/patients/:patientId/scenario',
  middleware: [jwtAuth, requirePermission('/twin', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            type: z.string().openapi({ example: 'tachycardia' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: successSchema } },
      description: 'Scenario injected',
    },
  },
})
twinRouter.openapi(scenarioRoute, async (c) => {
  const body = c.req.valid('json')
  await injectScenario(db, c.req.param('id'), c.req.param('patientId'), body.type)
  return c.json({ success: true })
})

export { twinRouter }
