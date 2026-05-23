import { z } from 'zod'
import { ALERT_SEVERITIES, ALERT_STATUSES } from '../constants'

export const eventKindSchema = z.enum(['observation', 'alert', 'behavior', 'location'])

export const eventTagsSchema = z.record(z.string(), z.unknown()).default({})

export const observationSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  deviceId: z.string().uuid().nullable(),
  kind: z.literal('observation'),
  metric: z.string().max(50),
  value: z.number().nullable(),
  unit: z.string().max(20).optional(),
  tags: eventTagsSchema,
  recordedAt: z.number(),
  createdAt: z.number(),
})

export const alertSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  deviceId: z.string().uuid().nullable(),
  kind: z.literal('alert'),
  metric: z.string().max(50),
  value: z.number().nullable(),
  unit: z.string().max(20).optional(),
  severity: z.enum(ALERT_SEVERITIES).nullable(),
  status: z.enum(ALERT_STATUSES).nullable(),
  tags: eventTagsSchema,
  recordedAt: z.number(),
  createdAt: z.number(),
})

export const observationIngestSchema = z.object({
  patientId: z.string().uuid(),
  deviceId: z.string().uuid(),
  metric: z.string().max(50),
  value: z.number(),
  unit: z.string().max(20).optional(),
  tags: eventTagsSchema,
  recordedAt: z.number().optional(), // 不传则用服务器时间
})

export const eventListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(100),
  kind: eventKindSchema.optional(),
  metric: z.string().optional(),
  patientId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  status: z.enum(ALERT_STATUSES).optional(),
  severity: z.enum(ALERT_SEVERITIES).optional(),
  from: z.number().optional(),
  to: z.number().optional(),
})

export const eventTimeSeriesInputSchema = z.object({
  patientId: z.string().uuid(),
  metric: z.string(),
  from: z.number(),
  to: z.number().optional(),
})

export type Kind = z.infer<typeof eventKindSchema>
export type Observation = z.infer<typeof observationSchema>
export type Alert = z.infer<typeof alertSchema>
export type ObservationIngestInput = z.infer<typeof observationIngestSchema>
export type EventListInput = z.infer<typeof eventListInputSchema>
export type EventTimeSeriesInput = z.infer<typeof eventTimeSeriesInputSchema>
