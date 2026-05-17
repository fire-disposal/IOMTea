import { z } from 'zod'

export const mapGetSchema = z.object({
  id: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
})

export const mapCreateSchema = z.object({
  patientId: z.string().uuid(),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  grid: z.array(z.array(z.any())),
})

export const mapUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  grid: z.array(z.array(z.any())).optional(),
  isActive: z.boolean().optional(),
})

export const entityListInputSchema = z.object({
  mapId: z.string().uuid(),
  category: z.enum(['furniture', 'structure', 'sensor', 'actor', 'marker']).optional(),
  roomId: z.string().uuid().optional(),
})

export const behaviorListInputSchema = z.object({
  patientId: z.string().uuid(),
})
