import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { plans, planItems } from '../../db/schema/plan'
import { protectedProcedure, router } from '../index'

const planItemInput = z.object({
  moduleKey: z.string().min(1).max(50),
  enabled: z.boolean().default(true),
  reminderEnabled: z.boolean().default(false),
  reminderTimes: z.array(z.object({ hour: z.number(), min: z.number() })).default([]),
  frequency: z.enum(['daily', 'multiple']).default('daily'),
  sortOrder: z.number().int().default(0),
})

const upsertInput = z.object({
  name: z.string().min(1).max(100).optional(),
  items: z.array(planItemInput),
})

export const planRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const [plan] = await ctx.db
      .select()
      .from(plans)
      .where(and(eq(plans.userId, ctx.userId!), eq(plans.isActive, true)))
      .limit(1)

    if (!plan) return null

    const items = await ctx.db
      .select()
      .from(planItems)
      .where(eq(planItems.planId, plan.id))
      .orderBy(planItems.sortOrder)

    return { ...plan, items }
  }),

  upsert: protectedProcedure
    .input(upsertInput)
    .mutation(async ({ ctx, input }) => {
      let [plan] = await ctx.db
        .select()
        .from(plans)
        .where(and(eq(plans.userId, ctx.userId!), eq(plans.isActive, true)))
        .limit(1)

      if (!plan) {
        const [created] = await ctx.db
          .insert(plans)
          .values({
            userId: ctx.userId!,
            name: input.name || '我的健康计划',
          })
          .returning()
        plan = created
      } else if (input.name) {
        await ctx.db
          .update(plans)
          .set({ name: input.name, updatedAt: new Date() })
          .where(eq(plans.id, plan.id))
      }

      const existing = await ctx.db
        .select()
        .from(planItems)
        .where(eq(planItems.planId, plan.id))

      const existingMap = new Map(existing.map((e) => [e.moduleKey, e]))

      for (const item of input.items) {
        const current = existingMap.get(item.moduleKey)
        if (current) {
          await ctx.db
            .update(planItems)
            .set({
              enabled: item.enabled,
              reminderEnabled: item.reminderEnabled,
              reminderTimes: item.reminderTimes,
              frequency: item.frequency,
              sortOrder: item.sortOrder,
              updatedAt: new Date(),
            })
            .where(eq(planItems.id, current.id))
        } else {
          await ctx.db.insert(planItems).values({
            planId: plan.id,
            moduleKey: item.moduleKey,
            enabled: item.enabled,
            reminderEnabled: item.reminderEnabled,
            reminderTimes: item.reminderTimes,
            frequency: item.frequency,
            sortOrder: item.sortOrder,
          })
        }
      }

      const items = await ctx.db
        .select()
        .from(planItems)
        .where(eq(planItems.planId, plan.id))
        .orderBy(planItems.sortOrder)

      return { ...plan, items }
    }),

  detail: protectedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [plan] = await ctx.db
        .select()
        .from(plans)
        .where(and(eq(plans.id, input.planId), eq(plans.userId, ctx.userId!)))
        .limit(1)

      if (!plan) return null

      const items = await ctx.db
        .select()
        .from(planItems)
        .where(eq(planItems.planId, plan.id))
        .orderBy(planItems.sortOrder)

      return { ...plan, items }
    }),
})
