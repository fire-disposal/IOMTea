import { createMiddleware } from 'hono/factory'

const store = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(maxRequests: number, windowMs: number) {
  return createMiddleware(async (c, next) => {
    const key = c.req.header('x-forwarded-for') || 'unknown'
    const now = Date.now()
    const entry = store.get(key) || { count: 0, resetAt: now + windowMs }
    if (now > entry.resetAt) {
      entry.count = 1
      entry.resetAt = now + windowMs
    } else {
      entry.count++
    }
    store.set(key, entry)
    if (entry.count > maxRequests) {
      return c.json(
        { error: 'Too many requests', retryAfter: Math.ceil((entry.resetAt - now) / 1000) },
        429,
      )
    }
    await next()
  })
}

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of store) {
    if (now > v.resetAt) store.delete(k)
  }
}, 60000)
