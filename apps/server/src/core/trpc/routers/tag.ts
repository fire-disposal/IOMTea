import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { adminProcedure } from '../middleware/rbac'
import { router } from '../init'
import { patientTags } from '../../db/schema/tag'

export const tagRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(patientTags).orderBy(patientTags.name)
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [tag] = await ctx.db
        .insert(patientTags)
        .values({
          name: input.name,
          color: input.color ?? '#228be6',
        })
        .returning()
      return tag
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(50).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const [tag] = await ctx.db
        .update(patientTags)
        .set(data)
        .where(eq(patientTags.id, id))
        .returning()
      return tag
    }),

  delete: adminProcedure.input(z.string().uuid()).mutation(async ({ ctx, input: id }) => {
    await ctx.db.delete(patientTags).where(eq(patientTags.id, id))
  }),
})
