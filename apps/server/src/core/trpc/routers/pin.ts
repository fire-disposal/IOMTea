import { randomInt } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { usersPin } from '../../db/schema/pin'
import { publicProcedure, protectedProcedure, router } from '../index'

export const pinRouter = router({
  verify: publicProcedure
    .input(z.object({ pin: z.string().min(4).max(6) }))
    .query(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .select()
        .from(usersPin)
        .where(eq(usersPin.pin, input.pin))
        .limit(1)
      return { valid: !!record, userId: record?.userId ?? null }
    }),
  list: protectedProcedure
    .input(z.object({ userId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const query = ctx.db.select().from(usersPin).$dynamic()
      if (input?.userId) query.where(eq(usersPin.userId, input.userId))
      return query
    }),

  create: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        label: z.string().max(64).optional(),
        nickname: z.string().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pin = String(randomInt(100000, 1000000))
      const [record] = await ctx.db
        .insert(usersPin)
        .values({
          pin,
          userId: input.userId,
          label: input.label ?? '',
          nickname: input.nickname ?? '',
        })
        .returning()
      return record
    }),

  update: protectedProcedure
    .input(
      z.object({
        pin: z.string().length(6),
        label: z.string().max(64).optional(),
        nickname: z.string().max(32).optional(),

      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { pin, ...updates } = input
      const [record] = await ctx.db
        .update(usersPin)
        .set(updates)
        .where(eq(usersPin.pin, pin))
        .returning()
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'PIN不存在' })
      return record
    }),

  bindRoom: protectedProcedure
    .input(z.object({ pin: z.string().min(4).max(6), roomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .update(usersPin)
        .set({ roomId: input.roomId })
        .where(eq(usersPin.pin, input.pin))
        .returning()
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'PIN不存在' })
      return record
    }),

  getRoom: publicProcedure
    .input(z.object({ pin: z.string().min(4).max(6) }))
    .query(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .select({ roomId: usersPin.roomId })
        .from(usersPin)
        .where(eq(usersPin.pin, input.pin))
        .limit(1)
      return { roomId: record?.roomId ?? null }
    }),

  reset: protectedProcedure
    .input(z.object({ oldPin: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(usersPin)
        .where(eq(usersPin.pin, input.oldPin))
        .limit(1)
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'PIN不存在' })
      const newPin = String(randomInt(100000, 1000000))
      await ctx.db.delete(usersPin).where(eq(usersPin.pin, input.oldPin))
      const [record] = await ctx.db
        .insert(usersPin)
        .values({
          pin: newPin,
          userId: existing.userId,
          type: existing.type,
          label: existing.label,
          nickname: existing.nickname,
          roomId: existing.roomId,
          isVirtual: existing.isVirtual,
          generatorConfig: existing.generatorConfig,
        })
        .returning()
      return record
    }),

  delete: protectedProcedure
    .input(z.object({ pin: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(usersPin).where(eq(usersPin.pin, input.pin))
      return { success: true }
    }),

  getByUser: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(usersPin).where(eq(usersPin.userId, input.userId))
    }),
})
