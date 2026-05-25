import { z } from 'zod'

export const planFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['choice', 'multi', 'likert', 'vas', 'number', 'text']),
  required: z.boolean().default(true),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  labels: z.array(z.string()).optional(),
  min_label: z.string().optional(),
  max_label: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional(),
  placeholder: z.string().optional(),
  rows: z.number().int().min(1).default(3).optional(),
})

export const planCreateSchema = z.object({
  code: z.string().min(1).max(64),
  title: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(planFieldSchema).default([]),
  rewardCredits: z.number().int().min(0).default(0),
  cron: z.string().optional(),
})

export const planUpdateSchema = planCreateSchema.partial().extend({
  status: z.enum(['active', 'archived']).optional(),
})

export const planCompleteSchema = z.object({
  patientId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  responses: z.record(z.string(), z.unknown()).optional(),
})

export const planSchema = planCreateSchema.extend({
  id: z.string().uuid(),
  status: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

export const planCompletionSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  patientId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  responses: z.record(z.string(), z.unknown()).nullable(),
  creditsEarned: z.number(),
  completedAt: z.string().nullable(),
})

export const creditTransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  patientId: z.string().uuid().nullable(),
  amount: z.number().int(),
  kind: z.string(),
  source: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().nullable(),
})

export type PlanCreate = z.infer<typeof planCreateSchema>
export type PlanUpdate = z.infer<typeof planUpdateSchema>
export type PlanComplete = z.infer<typeof planCompleteSchema>
export type Plan = z.infer<typeof planSchema>
export type PlanCompletion = z.infer<typeof planCompletionSchema>
export type CreditTransaction = z.infer<typeof creditTransactionSchema>
