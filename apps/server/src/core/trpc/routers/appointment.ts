import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  appointmentListInputSchema,
  followupCreateSchema,
  followupListInputSchema,
} from '@iomtea/shared-types'
import { z } from 'zod'
import { protectedProcedure, router } from '../index'
import * as appointmentService from '../../services/appointment'

export const appointmentRouter = router({
  list: protectedProcedure.input(appointmentListInputSchema).query(async ({ ctx, input }) => {
    return appointmentService.listAppointments(ctx.db, input.patientId, input.status, input.from, input.to)
  }),

  byId: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    return appointmentService.getAppointmentById(ctx.db, input.id)
  }),

  create: protectedProcedure.input(appointmentCreateSchema).mutation(async ({ ctx, input }) => {
    return appointmentService.createAppointment(ctx.db, input)
  }),

  update: protectedProcedure.input(appointmentUpdateSchema).mutation(async ({ ctx, input }) => {
    return appointmentService.updateAppointment(ctx.db, input.id, input)
  }),

  cancel: protectedProcedure.input(z.object({ id: z.string().uuid(), reason: z.string().optional() })).mutation(async ({ ctx, input }) => {
    return appointmentService.cancelAppointment(ctx.db, input.id, input.reason)
  }),

  followups: protectedProcedure.input(followupListInputSchema).query(async ({ ctx, input }) => {
    return appointmentService.listFollowups(ctx.db, input.patientId)
  }),

  createFollowup: protectedProcedure.input(followupCreateSchema).mutation(async ({ ctx, input }) => {
    return appointmentService.createFollowup(ctx.db, input)
  }),
})
