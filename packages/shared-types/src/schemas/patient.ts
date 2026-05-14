import { z } from 'zod'
import { GENDERS, PATIENT_STATUSES } from '../constants'

export const patientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(100),
  birthDate: z.string().max(10).nullable(),
  gender: z.enum(GENDERS).nullable(),
  room: z.string().nullable(),
  bedNumber: z.string().nullable(),
  status: z.enum(PATIENT_STATUSES),
  tags: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.number(),
})

export const patientCreateSchema = z.object({
  name: z.string().min(1).max(100),
  birthDate: z.string().optional(),
  gender: z.enum(GENDERS).optional(),
  room: z.string().max(20).optional(),
  bedNumber: z.string().max(20).optional(),
  heightCm: z.number().min(0).max(300).optional(),
  weightKg: z.number().min(0).max(500).optional(),
  bloodType: z.enum(['A', 'B', 'AB', 'O']).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().optional(),
  emergencyContact: z.string().max(100).optional(),
  emergencyPhone: z.string().max(20).optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
})

export const patientUpdateSchema = patientCreateSchema.partial()

export const patientListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(PATIENT_STATUSES).optional(),
})

export type Patient = z.infer<typeof patientSchema>
export type PatientCreateInput = z.infer<typeof patientCreateSchema>
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>
