import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { patients } from '../../db/schema'
import { protectedProcedure, router } from '../index'

const roomSchema = z.object({
  id: z.string(),
  name: z.string().min(1, '名称不能为空'),
  type: z.enum(['bedroom', 'livingroom', 'kitchen', 'bathroom', 'study', 'corridor', 'entry', 'balcony', 'storage', 'dining']),
  x: z.number().default(0),
  y: z.number().default(0),
  connections: z.array(z.string()).default([]),
})

const graphSchema = z.object({
  rooms: z.array(roomSchema).default([]),
  entryRoomId: z.string().nullable().default(null),
  personLocation: z.string().nullable().default(null),
})

export const homeGraphRouter = router({
  get: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [p] = await ctx.db.select({ tags: patients.tags }).from(patients).where(eq(patients.id, input.patientId)).limit(1)
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: '患者不存在' })
      const tags = (p.tags as Record<string, unknown>) || {}
      const graph = (tags.homeGraph as z.infer<typeof graphSchema>) || null
      return graph
    }),

  upsert: protectedProcedure
    .input(z.object({
      patientId: z.string().uuid(),
      graph: graphSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await ctx.db.select({ tags: patients.tags }).from(patients).where(eq(patients.id, input.patientId)).limit(1)
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: '患者不存在' })
      const currentTags = (p.tags as Record<string, unknown>) || {}
      const newTags = { ...currentTags, homeGraph: input.graph }
      await ctx.db.update(patients).set({ tags: newTags as any }).where(eq(patients.id, input.patientId))
      return { success: true }
    }),
})

export type HomeGraph = z.infer<typeof graphSchema>