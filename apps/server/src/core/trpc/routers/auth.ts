import { createHash } from 'node:crypto'
import {
  loginSchema,
  registerSchema,
  tokenPairSchema,
  wechatLoginSchema,
} from '@iomtea/shared-types'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { wechatAccounts } from '../../db'
import { refreshTokens, users, patients } from '../../db/schema.js'
import { userPatientLinks } from '../../db/schema/user-patient'
import { usersPin } from '../../db/schema/pin'
import { signAccessToken, signRefreshToken, verifyToken } from '../../lib/jwt'
import { hashPassword, verifyPassword } from '../../lib/password'
import { code2session } from '../../lib/wechat'
import { publicProcedure, router } from '../index'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db
      .select()
      .from(users)
      .where(eq(users.username, input.username))
      .limit(1)

    if (existing.length > 0) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Username already exists' })
    }

    const passwordHash = await hashPassword(input.password)

    const [user] = await ctx.db
      .insert(users)
      .values({
        username: input.username,
        passwordHash,
        displayName: input.displayName,
      })
      .returning()

    const pin = String(Math.floor(100000 + Math.random() * 900000))
    await ctx.db
      .insert(usersPin)
      .values({
        pin,
        userId: user.id,
        type: 'user',
        label: user.displayName,
      })
      .catch(() => {})

    const jwtPayload = { sub: user.id, role: user.role }
    const accessToken = await signAccessToken(jwtPayload)
    const refreshToken = await signRefreshToken(user.id)

    await ctx.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken.token),
      expiresAt: refreshToken.expiresAt,
    })

    return tokenPairSchema.parse({
      accessToken,
      refreshToken: refreshToken.token,
      expiresAt: refreshToken.expiresAt.getTime(),
      displayName: user.displayName,
    })
  }),

  login: publicProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.username, input.username))
      .limit(1)

    if (rows.length === 0) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })
    }

    const user = rows[0]
    if (!user.passwordHash) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })
    }
    const valid = await verifyPassword(user.passwordHash, input.password)

    if (!valid) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })
    }

    const jwtPayload = { sub: user.id, role: user.role }
    const accessToken = await signAccessToken(jwtPayload)
    const refreshToken = await signRefreshToken(user.id)

    await ctx.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken.token),
      expiresAt: refreshToken.expiresAt,
    })

    return tokenPairSchema.parse({
      accessToken,
      refreshToken: refreshToken.token,
      expiresAt: refreshToken.expiresAt.getTime(),
      displayName: user.displayName,
    })
  }),

  wechatLogin: publicProcedure.input(wechatLoginSchema).mutation(async ({ ctx, input }) => {
    const session = await code2session(input.code)
    const { openid, unionid } = session

    const existing = await ctx.db
      .select()
      .from(wechatAccounts)
      .where(eq(wechatAccounts.openId, openid))
      .limit(1)

    let userId: string
    let role: string
    let displayName: string

    if (existing.length > 0) {
      const user = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, existing[0].userId))
        .limit(1)
      if (user.length === 0) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Orphan wechat account' })
      }
      userId = user[0].id
      role = user[0].role
      displayName = user[0].displayName
    } else {
      const [newUser] = await ctx.db
        .insert(users)
        .values({
          displayName: `微信用户${openid.slice(-6)}`,
          role: 'user',
          status: 'active',
        })
        .returning()

      await ctx.db.insert(wechatAccounts).values({
        userId: newUser.id,
        openId: openid,
        unionId: unionid || null,
      })

      const [patientRecord] = await ctx.db
        .insert(patients)
        .values({
          name: `微信用户${openid.slice(-6)}`,
          status: 'active',
        })
        .returning()
        .catch((err) => {
          console.error('WeChat login: failed to create patient record', err)
          return []
        })

      if (patientRecord) {
        await ctx.db
          .insert(userPatientLinks)
          .values({
            userId: newUser.id,
            patientId: patientRecord.id,
            relation: 'primary',
          })
          .catch((err) => {
            console.error('WeChat login: failed to create user-patient link', err)
          })
      }

      userId = newUser.id
      role = newUser.role
      displayName = newUser.displayName
    }

    await ctx.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId))

    const jwtPayload = { sub: userId, role }
    const accessToken = await signAccessToken(jwtPayload)
    const refreshToken = await signRefreshToken(userId)

    await ctx.db.insert(refreshTokens).values({
      userId,
      tokenHash: hashToken(refreshToken.token),
      expiresAt: refreshToken.expiresAt,
    })

    return tokenPairSchema.parse({
      accessToken,
      refreshToken: refreshToken.token,
      expiresAt: refreshToken.expiresAt.getTime(),
      displayName,
    })
  }),

  refresh: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tokenHash = hashToken(input.refreshToken)

      const rows = await ctx.db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1)

      if (rows.length === 0) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' })
      }

      const stored = rows[0]

      if (new Date() > stored.expiresAt) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token expired' })
      }

      const userRows = await ctx.db.select().from(users).where(eq(users.id, stored.userId)).limit(1)

      if (userRows.length === 0) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found' })
      }

      const user = userRows[0]

      const jwtPayload = { sub: user.id, role: user.role }
      const accessToken = await signAccessToken(jwtPayload)
      const newRefreshToken = await signRefreshToken(user.id)

      // Insert new first, then delete old — avoids gap during rotation
      await ctx.db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: hashToken(newRefreshToken.token),
        expiresAt: newRefreshToken.expiresAt,
      })
      await ctx.db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id))

      return tokenPairSchema.parse({
        accessToken,
        refreshToken: newRefreshToken.token,
        expiresAt: newRefreshToken.expiresAt.getTime(),
      })
    }),
})
