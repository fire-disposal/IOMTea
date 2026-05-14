import {
  medicationCreateSchema,
  medicationUpdateSchema,
  medicationListInputSchema,
  medicationScheduleSchema,
  medicationAdherenceListInputSchema,
  markTakenSchema,
  markMissedSchema,
} from '@iomtea/shared-types'
import { z } from 'zod'
import { protectedProcedure, router } from '../index'
import * as medicationService from '../../services/medication'

export const medicationRouter = router({
  list: protectedProcedure.input(medicationListInputSchema).query(async ({ ctx, input }) => {
    return medicationService.listMedications(ctx.db, input.patientId, input.status)
  }),

  byId: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    return medicationService.getMedicationById(ctx.db, input.id)
  }),

  create: protectedProcedure.input(medicationCreateSchema).mutation(async ({ ctx, input }) => {
    return medicationService.createMedication(ctx.db, input)
  }),

  update: protectedProcedure.input(medicationUpdateSchema).mutation(async ({ ctx, input }) => {
    return medicationService.updateMedication(ctx.db, input.id, input)
  }),

  delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await medicationService.deleteMedication(ctx.db, input.id)
    return { success: true }
  }),

  schedules: protectedProcedure.input(z.object({ medicationId: z.string().uuid() })).query(async ({ ctx, input }) => {
    return medicationService.listSchedules(ctx.db, input.medicationId)
  }),

  createSchedule: protectedProcedure.input(medicationScheduleSchema).mutation(async ({ ctx, input }) => {
    return medicationService.createSchedule(ctx.db, input.medicationId, input.scheduledTime, input.dayOfWeek)
  }),

  adherence: protectedProcedure.input(medicationAdherenceListInputSchema).query(async ({ ctx, input }) => {
    return medicationService.getAdherence(ctx.db, input.scheduleId, input.from, input.to)
  }),

  markTaken: protectedProcedure.input(markTakenSchema).mutation(async ({ ctx, input }) => {
    return medicationService.markTaken(ctx.db, input)
  }),

  markMissed: protectedProcedure.input(markMissedSchema).mutation(async ({ ctx, input }) => {
    return medicationService.markMissed(ctx.db, input)
  }),
})
