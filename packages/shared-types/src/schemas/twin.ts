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

export const roomCreateSchema = z.object({
  mapId: z.string().uuid(),
  name: z.string().min(1),
  roomType: z.enum(['bedroom', 'livingroom', 'kitchen', 'bathroom', 'study', 'corridor', 'custom']),
  boundsX: z.number().int(),
  boundsY: z.number().int(),
  boundsW: z.number().int().positive(),
  boundsH: z.number().int().positive(),
  color: z.string().optional(),
})

export const roomUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  roomType: z.enum(['bedroom', 'livingroom', 'kitchen', 'bathroom', 'study', 'corridor', 'custom']).optional(),
  boundsX: z.number().int().optional(),
  boundsY: z.number().int().optional(),
  boundsW: z.number().int().positive().optional(),
  boundsH: z.number().int().positive().optional(),
  color: z.string().optional(),
})

export const entityListInputSchema = z.object({
  mapId: z.string().uuid(),
  category: z.enum(['furniture', 'structure', 'sensor', 'actor', 'marker']).optional(),
  roomId: z.string().uuid().optional(),
})

export const entityCreateSchema = z.object({
  mapId: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  defId: z.string().min(1),
  category: z.enum(['furniture', 'structure', 'sensor', 'actor', 'marker']),
  gridX: z.number().int(),
  gridY: z.number().int(),
  orientation: z.enum(['N', 'S', 'E', 'W']).default('N'),
  layer: z.number().int().default(0),
  deviceId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
})

export const entityUpdateSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid().optional().nullable(),
  gridX: z.number().int().optional(),
  gridY: z.number().int().optional(),
  orientation: z.enum(['N', 'S', 'E', 'W']).optional(),
  layer: z.number().int().optional(),
  deviceId: z.string().uuid().optional().nullable(),
  patientId: z.string().uuid().optional().nullable(),
})

export const instructionSchema = z.object({
  actorEntityId: z.string().uuid(),
  type: z.enum(['move_to', 'move_to_room', 'use_object', 'stay', 'change_posture', 'idle']),
  params: z.record(z.any()),
  priority: z.number().int().default(0),
  preemptible: z.boolean().default(true),
})

export const behaviorListInputSchema = z.object({
  patientId: z.string().uuid(),
})

export const behaviorCreateSchema = z.object({
  patientId: z.string().uuid(),
  ruleType: z.enum(['schedule', 'trigger', 'routine']),
  name: z.string().min(1),
  triggerTime: z.string().optional(),
  triggerCondition: z.record(z.any()).optional(),
  actions: z.array(z.any()),
  priority: z.number().int().default(0),
  isEnabled: z.boolean().default(true),
})

export const behaviorUpdateSchema = behaviorCreateSchema.partial().extend({
  id: z.string().uuid(),
})

export const activityListInputSchema = z.object({
  actorEntityId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(500).default(100),
})

export const cvDetectionListInputSchema = z.object({
  patientId: z.string().uuid().optional(),
  mapId: z.string().uuid().optional(),
  cameraId: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(50),
})
