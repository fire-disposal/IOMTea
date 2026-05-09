import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { protectedProcedure, router } from '../index'
import { ALERT_SEVERITIES, ALERT_STATUSES } from '@iomtea/shared-types'
import { alertEvents } from '../../db/schema'

export const alertRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z.enum(ALERT_STATUSES).optional(),
        severity: z.enum(ALERT_SEVERITIES).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize
      let query = ctx.db.select().from(alertEvents).$dynamic()
      if (input.status) query = query.where(eq(alertEvents.status, input.status))
      if (input.severity) query = query.where(eq(alertEvents.severity, input.severity))
      const rows = await query
        .limit(input.pageSize)
        .offset(offset)
        .orderBy(desc(alertEvents.recordedAt))

      return rows.map((a) => ({
        id: a.id,
        deviceId: a.deviceId,
        patientId: a.patientId,
        type: a.type,
        severity: a.severity,
        status: a.status,
        payload: a.payload,
        recordedAt: a.recordedAt.getTime(),
        createdAt: a.createdAt.getTime(),
      }))
    }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(alertEvents)
        .set({ status: 'acknowledged' })
        .where(eq(alertEvents.id, input.id))
        .returning()

      return { id: updated.id, status: updated.status }
    }),

  resolve: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(alertEvents)
        .set({ status: 'resolved' })
        .where(eq(alertEvents.id, input.id))
        .returning()

      return { id: updated.id, status: updated.status }
    }),
})
