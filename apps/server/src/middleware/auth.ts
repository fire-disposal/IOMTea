import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../core/http/types'
import { verifyToken } from '../core/lib/jwt'

export const jwtAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing or invalid token' }, 401)
  }
  try {
    const payload = await verifyToken(header.slice(7))
    c.set('userId', payload.sub as string)
    c.set('userRole', payload.role as string)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401)
  }
})
