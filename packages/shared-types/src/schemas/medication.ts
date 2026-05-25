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

export type MedicationCreateInput = z.infer<typeof medicationCreateSchema>
export type MedicationUpdateInput = z.infer<typeof medicationUpdateSchema>
export type MedicationListInput = z.infer<typeof medicationListInputSchema>
