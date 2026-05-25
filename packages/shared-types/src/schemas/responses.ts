import { z } from 'zod'

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    role: z.string(),
    displayName: z.string().nullable(),
  }),
})

export const userResponseSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  role: z.string(),
  displayName: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  credit: z.number().default(0),
  status: z.string(),
  createdAt: z.string().nullable(),
})

export const dashboardResponseSchema = z.object({
  patientCount: z.number(),
  activeAlerts24h: z.number(),
  criticalAlerts: z.number(),
})

export const patientResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  gender: z.string().nullable(),
  birthDate: z.string().nullable(),
  heightCm: z.number().nullable(),
  weightKg: z.number().nullable(),
  bloodType: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  status: z.string(),
  tags: z.unknown().nullable(),
  createdAt: z.string().nullable(),
})

export const patientListSchema = z.array(patientResponseSchema)

export const alertResponseSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  kind: z.string(),
  metric: z.string(),
  value: z.unknown(),
  unit: z.string().nullable(),
  severity: z.string().nullable(),
  status: z.string().nullable(),
  source: z.string().nullable(),
  recordedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  tags: z.unknown().nullable(),
})

export const alertListSchema = z.array(alertResponseSchema)

export const successSchema = z.object({ success: z.boolean() })

export const pinResponseSchema = z.object({
  pin: z.string(),
  userId: z.string(),
  type: z.string(),
  label: z.string().nullable(),
  isVirtual: z.boolean().nullable(),
  createdAt: z.string().nullable(),
})

export const pinListSchema = z.array(pinResponseSchema)

export const tagResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: z.string().nullable(),
})

export const tagListSchema = z.array(tagResponseSchema)

export const metricResponseSchema = z.object({
  metric: z.string(),
  displayName: z.string(),
  unit: z.string(),
  valueType: z.string(),
  fields: z
    .array(
      z.object({
        path: z.string(),
        label: z.string(),
        type: z.string(),
      }),
    )
    .optional(),
  defaultChart: z.string(),
  category: z.string(),
  normalRange: z
    .object({
      min: z.number(),
      max: z.number(),
    })
    .nullable()
    .optional(),
})

export const profileResponseSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  baselines: z.record(z.string(), z.unknown()).optional(),
  metrics: z.array(z.unknown()).optional(),
})

export const simulationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  profileName: z.string(),
  running: z.boolean(),
  metrics: z.array(z.unknown()),
  patientCount: z.number(),
})

export type AuthResponse = z.infer<typeof authResponseSchema>
export type UserResponse = z.infer<typeof userResponseSchema>
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>
export type PatientResponse = z.infer<typeof patientResponseSchema>
export type AlertResponse = z.infer<typeof alertResponseSchema>
export type PinResponse = z.infer<typeof pinResponseSchema>
export type TagResponse = z.infer<typeof tagResponseSchema>
export type MetricResponse = z.infer<typeof metricResponseSchema>
export type ProfileResponse = z.infer<typeof profileResponseSchema>
export type SimulationResponse = z.infer<typeof simulationResponseSchema>
