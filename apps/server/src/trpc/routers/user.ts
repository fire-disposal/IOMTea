import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { protectedProcedure, router } from '../index'
import { userSchema, userUpdateSchema, userListInputSchema } from '@iomtea/shared-types'
import { users } from '../../db/schema'

export const userRouter = router({
  list: protectedProcedure
    .input(userListInputSchema)
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize
      const rows = await ctx.db
        .select()
        .from(users)
        .limit(input.pageSize)
        .offset(offset)
        .orderBy(users.createdAt)

      return rows.map((u) => userSchema.parse({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt.getTime(),
      }))
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1)

    if (rows.length === 0) throw new Error('User not found')
    const u = rows[0]
    return userSchema.parse({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt.getTime(),
    })
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: userUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set(input.data)
        .where(eq(users.id, input.id))
        .returning()

      if (!updated) throw new Error('User not found')
      return userSchema.parse({
        id: updated.id,
        username: updated.username,
        displayName: updated.displayName,
        role: updated.role,
        createdAt: updated.createdAt.getTime(),
      })
    }),
})
