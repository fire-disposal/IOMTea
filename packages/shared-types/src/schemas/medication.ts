import { z } from 'zod'

export const medicationCreateSchema = z.object({
  patientId: z.string().uuid(),
  drugName: z.string().min(1),
  genericName: z.string().optional(),
  dosage: z.string().min(1),
  dosageUnit: z.string().min(1),
  frequency: z.string().min(1),
  route: z.enum(['oral', 'injection', 'topical', 'inhalation', 'other']).default('oral'),
  startDate: z.string(),
  endDate: z.string().optional(),
  instructions: z.string().optional(),
  status: z.enum(['active', 'completed', 'paused', 'cancelled']).default('active'),
})

export const medicationUpdateSchema = medicationCreateSchema.partial().extend({
  id: z.string().uuid(),
})

export const medicationListInputSchema = z.object({
  patientId: z.string().uuid(),
  status: z.enum(['active', 'completed', 'paused', 'cancelled']).optional(),
})

export const medicationScheduleSchema = z.object({
  medicationId: z.string().uuid(),
  scheduledTime: z.string(),
  dayOfWeek: z.array(z.number().int().min(1).max(7)).optional(),
})

export const medicationAdherenceListInputSchema = z.object({
  scheduleId: z.string().uuid(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const markTakenSchema = z.object({
  scheduleId: z.string().uuid(),
  dueDate: z.string(),
  dueTime: z.string(),
  confirmedBy: z.enum(['self', 'family', 'auto', 'unknown']).default('self'),
  notes: z.string().optional(),
})

export const markMissedSchema = z.object({
  scheduleId: z.string().uuid(),
  dueDate: z.string(),
  dueTime: z.string(),
  notes: z.string().optional(),
})

export type MedicationCreateInput = z.infer<typeof medicationCreateSchema>
export type MedicationUpdateInput = z.infer<typeof medicationUpdateSchema>
export type MedicationListInput = z.infer<typeof medicationListInputSchema>
export type MedicationScheduleInput = z.infer<typeof medicationScheduleSchema>
export type MedicationAdherenceListInput = z.infer<typeof medicationAdherenceListInputSchema>
export type MarkTakenInput = z.infer<typeof markTakenSchema>
export type MarkMissedInput = z.infer<typeof markMissedSchema>
