import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { authResponseSchema } from '@iomtea/shared-types'
import { and, eq, gt } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '../core/db'
import { refreshTokens, users } from '../core/db/schema'
import { wechatAccounts } from '../core/db/schema/auth-ext'
import { signAccessToken, signRefreshToken, verifyToken } from '../core/lib/jwt'
import { hashPassword, verifyPassword } from '../core/lib/password'
import { code2session } from '../core/lib/wechat'

const auth = new OpenAPIHono()

const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            username: z.string().min(3).max(50).openapi({ example: 'researcher' }),
            password: z.string().min(6).openapi({ example: 'secret123' }),
            displayName: z.string().optional().openapi({ example: '研究员' }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: authResponseSchema } },
      description: 'User created',
    },
    409: { description: 'Username taken' },
  },
})

auth.openapi(registerRoute, async (c) => {
  const body = c.req.valid('json')
  const existing = await db.select().from(users).where(eq(users.username, body.username)).limit(1)
  if (existing.length) return c.json({ error: 'Username already taken' }, 409 as any)

  const [user] = await db
    .insert(users)
    .values({
      username: body.username,
      passwordHash: await hashPassword(body.password),
      displayName: body.displayName ?? body.username,
      role: 'user',
    })
    .returning()

  return c.json({ id: user.id, username: user.username, displayName: user.displayName }, 201 as any)
})

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            username: z.string().openapi({ example: 'admin' }),
            password: z.string().openapi({ example: 'admin123' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: authResponseSchema } },
      description: 'Login success',
    },
    401: { description: 'Invalid credentials' },
  },
})

auth.openapi(loginRoute, async (c) => {
  const body = c.req.valid('json')
  const [user] = await db.select().from(users).where(eq(users.username, body.username)).limit(1)
  if (!user) return c.json({ error: 'Invalid credentials' }, 401 as any)

  const valid = await verifyPassword(user.passwordHash!, body.password)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401 as any)

  const accessToken = await signAccessToken({ sub: user.id, role: user.role })
  const refreshTokenResult = await signRefreshToken(user.id)

  return c.json({
    accessToken,
    refreshToken: refreshTokenResult.token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    },
  })
})

const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            refreshToken: z.string().openapi({ example: '...' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: authResponseSchema } },
      description: 'Token refreshed',
    },
    401: { description: 'Invalid refresh token' },
  },
})

auth.openapi(refreshRoute, async (c) => {
  const body = c.req.valid('json')
  try {
    const payload = await verifyToken(body.refreshToken)
    const userId = payload.sub as string

    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.userId, userId), gt(refreshTokens.expiresAt, new Date())))
      .limit(1)

    if (!stored) return c.json({ error: 'Invalid or expired refresh token' }, 401 as any)

    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id))

    const accessToken = await signAccessToken({ sub: userId, role: payload.role })
    const newRefreshResult = await signRefreshToken(userId)

    return c.json({ accessToken, refreshToken: newRefreshResult.token })
  } catch {
    return c.json({ error: 'Invalid refresh token' }, 401 as any)
  }
})

// ── WeChat login ──

const wechatLoginRoute = createRoute({
  method: 'post', path: '/wechat-login',
  request: { body: { content: { 'application/json': { schema: z.object({ code: z.string().min(1) }) } } } },
  responses: { 200: { description: 'OK' }, 400: { description: 'WeChat login failed' } },
})

auth.openapi(wechatLoginRoute, async (c) => {
  const body = c.req.valid('json')
  let session
  try { session = await code2session(body.code) } catch { return c.json({ error: 'WeChat failed' } as any, 400) }

  const [account] = await db.select().from(wechatAccounts).where(eq(wechatAccounts.openId, session.openid)).limit(1)

  let userId: string
  if (account) { userId = account.userId }
  else {
    const [newUser] = await db.insert(users).values({ username: `wx_${session.openid.slice(0, 8)}`, displayName: '微信用户', role: 'user', passwordHash: '' } as any).returning()
    await db.insert(wechatAccounts).values({ userId: newUser.id, openId: session.openid } as any)
    userId = newUser.id
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const accessToken = await signAccessToken({ sub: userId, role: user!.role })
  const rt = await signRefreshToken(userId)
  return c.json({ accessToken, refreshToken: rt.token, user: { id: user!.id, username: user!.username, role: user!.role, displayName: user!.displayName } })
})

export { auth }
