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
import { requirePermission } from '../middleware/rbac'
import { protectedProcedure, router } from '../index'
import * as medicationService from '../../services/medication'

export const medicationRouter = router({
  list: protectedProcedure
    .use(requirePermission('medication:read'))
    .input(medicationListInputSchema)
    .query(async ({ ctx, input }) => {
      return medicationService.listMedications(ctx.db, input.patientId, input.status)
    }),

  listAll: protectedProcedure
    .use(requirePermission('medication:read'))
    .input(
      z
        .object({
          status: z.enum(['active', 'completed', 'paused', 'cancelled']).optional(),
          patientIds: z.array(z.string().uuid()).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return medicationService.listAllMedications(
        ctx.db,
        input as Parameters<typeof medicationService.listAllMedications>[1],
      )
    }),

  byId: protectedProcedure
    .use(requirePermission('medication:read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return medicationService.getMedicationById(ctx.db, input.id)
    }),

  create: protectedProcedure
    .use(requirePermission('medication:write'))
    .input(medicationCreateSchema)
    .mutation(async ({ ctx, input }) => {
      return medicationService.createMedication(ctx.db, input)
    }),

  update: protectedProcedure
    .use(requirePermission('medication:write'))
    .input(medicationUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      return medicationService.updateMedication(ctx.db, input.id, input)
    }),

  delete: protectedProcedure
    .use(requirePermission('medication:write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await medicationService.deleteMedication(ctx.db, input.id)
      return { success: true }
    }),

  schedules: protectedProcedure
    .use(requirePermission('medication:read'))
    .input(z.object({ medicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return medicationService.listSchedules(ctx.db, input.medicationId)
    }),

  createSchedule: protectedProcedure
    .use(requirePermission('medication:write'))
    .input(medicationScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      return medicationService.createSchedule(
        ctx.db,
        input.medicationId,
        input.scheduledTime,
        input.dayOfWeek,
      )
    }),

  adherence: protectedProcedure
    .use(requirePermission('medication:read'))
    .input(medicationAdherenceListInputSchema)
    .query(async ({ ctx, input }) => {
      return medicationService.getAdherence(ctx.db, input.scheduleId, input.from, input.to)
    }),

  markTaken: protectedProcedure
    .use(requirePermission('medication:write'))
    .input(markTakenSchema)
    .mutation(async ({ ctx, input }) => {
      return medicationService.markTaken(ctx.db, input)
    }),

  markMissed: protectedProcedure
    .use(requirePermission('medication:write'))
    .input(markMissedSchema)
    .mutation(async ({ ctx, input }) => {
      return medicationService.markMissed(ctx.db, input)
    }),
})
