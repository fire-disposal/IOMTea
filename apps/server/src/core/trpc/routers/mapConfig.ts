import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { protectedProcedure, router } from '../index'
import { mapConfigs } from '../../db/schema'

export const mapConfigRouter = router({
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(mapConfigs)
        .where(eq(mapConfigs.id, input.id))
        .limit(1)

      return row ? (row.data as Record<string, unknown>) : null
    }),

  save: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(mapConfigs)
        .values({
          id: input.id,
          data: input.data as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: mapConfigs.id,
          set: {
            data: input.data as Record<string, unknown>,
            updatedAt: new Date(),
          },
        })

      return { success: true }
    }),
})
