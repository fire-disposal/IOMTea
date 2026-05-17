import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  appointmentListInputSchema,
  followupCreateSchema,
  followupListInputSchema,
} from '@iomtea/shared-types'
import { z } from 'zod'
import { requirePermission } from '../middleware/rbac'
import { protectedProcedure, router } from '../index'
import * as appointmentService from '../../services/appointment'

export const appointmentRouter = router({
  list: protectedProcedure.use(requirePermission('appointment:read')).input(appointmentListInputSchema).query(async ({ ctx, input }) => {
    return appointmentService.listAppointments(ctx.db, input.patientId, input.status, input.from, input.to)
  }),

  listAll: protectedProcedure
    .use(requirePermission('appointment:read'))
    .input(
      z
        .object({
          status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
          patientIds: z.array(z.string().uuid()).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return appointmentService.listAllAppointments(ctx.db, input as Parameters<typeof appointmentService.listAllAppointments>[1])
    }),

  byId: protectedProcedure.use(requirePermission('appointment:read')).input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    return appointmentService.getAppointmentById(ctx.db, input.id)
  }),

  create: protectedProcedure.use(requirePermission('appointment:write')).input(appointmentCreateSchema).mutation(async ({ ctx, input }) => {
    return appointmentService.createAppointment(ctx.db, input)
  }),

  update: protectedProcedure.use(requirePermission('appointment:write')).input(appointmentUpdateSchema).mutation(async ({ ctx, input }) => {
    return appointmentService.updateAppointment(ctx.db, input.id, input)
  }),

  cancel: protectedProcedure.use(requirePermission('appointment:write')).input(z.object({ id: z.string().uuid(), reason: z.string().optional() })).mutation(async ({ ctx, input }) => {
    return appointmentService.cancelAppointment(ctx.db, input.id, input.reason)
  }),

  followups: protectedProcedure.use(requirePermission('appointment:read')).input(followupListInputSchema).query(async ({ ctx, input }) => {
    return appointmentService.listFollowups(ctx.db, input.patientId)
  }),

  createFollowup: protectedProcedure.use(requirePermission('appointment:write')).input(followupCreateSchema).mutation(async ({ ctx, input }) => {
    return appointmentService.createFollowup(ctx.db, input)
  }),
})
