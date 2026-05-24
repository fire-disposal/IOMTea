import { ALERT_SEVERITIES, ALERT_STATUSES, alertSchema } from '@iomtea/shared-types'
import { TRPCError } from '@trpc/server'
import { and, desc, eq, gte } from 'drizzle-orm'
import { z } from 'zod'
import { events } from '../../db/schema.js'
import { requirePermission } from '../middleware/rbac'
import { protectedProcedure, router } from '../index'

export const alertRouter = router({
  list: protectedProcedure
    .use(requirePermission('alert:read'))
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z.enum(ALERT_STATUSES).optional(),
        severity: z.enum(ALERT_SEVERITIES).optional(),
        patientId: z.string().uuid().optional(),
        from: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize
      const conditions = [eq(events.kind, 'alert')]
      if (input.status) conditions.push(eq(events.status, input.status))
      if (input.severity) conditions.push(eq(events.severity, input.severity))
      if (input.patientId) conditions.push(eq(events.patientId, input.patientId))
      if (input.from) conditions.push(gte(events.recordedAt, new Date(input.from)))

      const rows = await ctx.db
        .select()
        .from(events)
        .where(and(...conditions))
        .limit(input.pageSize)
        .offset(offset)
        .orderBy(desc(events.recordedAt))

      return z.array(alertSchema).parse(
        rows.map((a) => ({
          id: a.id,
          patientId: a.patientId,
          deviceId: a.deviceId,
          kind: 'alert' as const,
          metric: a.metric,
          value: a.value,
          unit: a.unit,
          severity: a.severity,
          status: a.status,
          tags: a.tags,
          recordedAt: a.recordedAt.getTime(),
          createdAt: a.createdAt.getTime(),
        })),
      )
    }),

  acknowledge: protectedProcedure
    .use(requirePermission('alert:manage'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(events)
        .set({ status: 'acknowledged' })
        .where(and(eq(events.id, input.id), eq(events.kind, 'alert')))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' })
      }
      return alertSchema
        .pick({ id: true, status: true })
        .parse({ id: updated.id, status: updated.status })
    }),

  resolve: protectedProcedure
    .use(requirePermission('alert:manage'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(events)
        .set({ status: 'resolved' })
        .where(and(eq(events.id, input.id), eq(events.kind, 'alert')))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' })
      }
      return alertSchema
        .pick({ id: true, status: true })
        .parse({ id: updated.id, status: updated.status })
    }),

  assign: protectedProcedure
    .use(requirePermission('alert:manage'))
    .input(z.object({ alertId: z.string().uuid(), assigneeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(events)
        .set({ status: 'assigned' })
        .where(and(eq(events.id, input.alertId), eq(events.kind, 'alert')))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' })
      }
      return alertSchema
        .pick({ id: true, status: true })
        .parse({ id: updated.id, status: updated.status })
    }),

  handle: protectedProcedure
    .use(requirePermission('alert:manage'))
    .input(z.object({ alertId: z.string().uuid(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [alert] = await ctx.db
        .select({ tags: events.tags })
        .from(events)
        .where(and(eq(events.id, input.alertId), eq(events.kind, 'alert')))
        .limit(1)

      if (!alert) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' })
      }

      const tags = { ...((alert.tags as Record<string, unknown>) || {}) }
      if (input.note) tags.handle_note = input.note
      tags.handled_at = new Date().toISOString()

      const [updated] = await ctx.db
        .update(events)
        .set({ status: 'handled', tags })
        .where(and(eq(events.id, input.alertId), eq(events.kind, 'alert')))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' })
      }
      return alertSchema
        .pick({ id: true, status: true })
        .parse({ id: updated.id, status: updated.status })
    }),

  close: protectedProcedure
    .use(requirePermission('alert:manage'))
    .input(z.object({ alertId: z.string().uuid(), resolution: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [alert] = await ctx.db
        .select({ tags: events.tags })
        .from(events)
        .where(and(eq(events.id, input.alertId), eq(events.kind, 'alert')))
        .limit(1)

      if (!alert) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' })
      }

      const tags = { ...((alert.tags as Record<string, unknown>) || {}) }
      if (input.resolution) tags.resolution = input.resolution
      tags.closed_at = new Date().toISOString()

      const [updated] = await ctx.db
        .update(events)
        .set({ status: 'closed', tags })
        .where(and(eq(events.id, input.alertId), eq(events.kind, 'alert')))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Alert not found' })
      }
      return alertSchema
        .pick({ id: true, status: true })
        .parse({ id: updated.id, status: updated.status })
    }),
})
