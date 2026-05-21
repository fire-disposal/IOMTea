import { eq } from 'drizzle-orm'
import { streaks } from '../../db/schema/plan'
import { protectedProcedure, router } from '../index'

export const streakRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select().from(streaks).where(eq(streaks.userId, ctx.userId!))

    return rows.map((r) => ({
      moduleKey: r.moduleKey,
      currentStreak: r.currentStreak,
      longestStreak: r.longestStreak,
      lastRecordDate: r.lastRecordDate,
    }))
  }),
})
