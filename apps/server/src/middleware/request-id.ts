import { randomUUID } from 'node:crypto'
import { createMiddleware } from 'hono/factory'

export const requestId = createMiddleware(async (c, next) => {
  const id = c.req.header('x-request-id') || randomUUID()
  c.set('requestId', id)
  c.res.headers.set('x-request-id', id)
  await next()
})
