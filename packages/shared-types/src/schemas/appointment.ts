import { z } from 'zod'

export const appointmentCreateSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid().optional(),
  appointmentType: z.enum(['checkup', 'followup', 'emergency', 'consultation', 'rehabilitation']),
  scheduledAt: z.string(),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  reason: z.string().optional(),
  notes: z.string().optional(),
  location: z.string().default('居家'),
})

export const appointmentUpdateSchema = appointmentCreateSchema.partial().extend({
  id: z.string().uuid(),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
})

export const appointmentListInputSchema = z.object({
  patientId: z.string().uuid(),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const followupCreateSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  type: z.enum(['phone', 'video', 'home_visit', 'clinic', 'message']),
  summary: z.string().optional(),
  vitalSigns: z.record(z.unknown()).optional(),
  assessment: z.string().optional(),
  nextFollowupAt: z.string().optional(),
})

export const followupListInputSchema = z.object({
  patientId: z.string().uuid(),
})
