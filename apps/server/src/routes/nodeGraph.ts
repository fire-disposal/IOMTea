import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { successSchema } from '@iomtea/shared-types'
import { jwtAuth } from '../middleware/auth'

const nodeGraphApp = new OpenAPIHono()
nodeGraphApp.use('*', jwtAuth)

const getRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ nodes: z.array(z.unknown()), edges: z.array(z.unknown()) }),
        },
      },
      description: 'Node graph',
    },
  },
})

nodeGraphApp.openapi(getRoute, async (c) => {
  return c.json({ nodes: [], edges: [] })
})

const saveRoute = createRoute({
  method: 'put',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            nodes: z.array(z.unknown()).optional(),
            edges: z.array(z.unknown()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Saved' },
  },
})

nodeGraphApp.openapi(saveRoute, async (c) => {
  return c.json({ success: true })
})

export { nodeGraphApp }
