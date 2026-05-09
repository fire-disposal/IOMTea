import { z } from 'zod'
import { USER_ROLES } from '../constants'

export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  role: z.enum(USER_ROLES),
  createdAt: z.number(),
})

export const userUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
})

export const userListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export type User = z.infer<typeof userSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
