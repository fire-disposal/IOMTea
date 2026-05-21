import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { dailyChecklists, planItems, plans } from '../../db/schema/plan'
import { protectedProcedure, router } from '../index'

export const checklistRouter = router({
  today: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10)

    const existing = await ctx.db
      .select()
      .from(dailyChecklists)
      .where(and(eq(dailyChecklists.userId, ctx.userId!), eq(dailyChecklists.date, today)))

    if (existing.length > 0) return existing

    const [activePlan] = await ctx.db
      .select()
      .from(plans)
      .where(and(eq(plans.userId, ctx.userId!), eq(plans.isActive, true)))
      .limit(1)

    if (!activePlan) return []

    const items = await ctx.db
      .select()
      .from(planItems)
      .where(and(eq(planItems.planId, activePlan.id), eq(planItems.enabled, true)))

    if (items.length === 0) return []

    const rows = items.map((item) => ({
      userId: ctx.userId!,
      date: today,
      moduleKey: item.moduleKey,
      status: 'pending' as const,
      planItemId: item.id,
    }))

    await ctx.db.insert(dailyChecklists).values(rows)

    const created = await ctx.db
      .select()
      .from(dailyChecklists)
      .where(and(eq(dailyChecklists.userId, ctx.userId!), eq(dailyChecklists.date, today)))

    return created
  }),

  skip: protectedProcedure
    .input(z.object({ checklistId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(dailyChecklists)
        .set({ status: 'skipped' })
        .where(
          and(eq(dailyChecklists.id, input.checklistId), eq(dailyChecklists.userId, ctx.userId!)),
        )
      return { success: true }
    }),
})
