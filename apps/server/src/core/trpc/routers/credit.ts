import { eq, desc, and } from 'drizzle-orm'
import { z } from 'zod'
import { creditTransactions } from '../../db/schema/plan'
import { users } from '../../db/schema.js'
import { protectedProcedure, router } from '../index'

export const creditRouter = router({
  balance: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select({ credit: users.credit })
      .from(users)
      .where(eq(users.id, ctx.userId!))
      .limit(1)

    return { balance: user?.credit ?? 0 }
  }),

  transactions: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
        type: z.enum(['earn', 'spend', 'adjust']).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(creditTransactions.userId, ctx.userId!)]
      if (input.type) conditions.push(eq(creditTransactions.type, input.type))

      const rows = await ctx.db
        .select()
        .from(creditTransactions)
        .where(and(...conditions))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize)

      return rows
    }),
})
