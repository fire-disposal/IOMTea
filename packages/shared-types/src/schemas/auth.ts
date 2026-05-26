import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(8).max(100),
})

export const registerSchema = z.object({
  username: z.string().min(2).max(50),
  password: z
    .string()
    .min(8, '密码至少8位')
    .max(100)
    .regex(/[A-Z]/, '需要包含大写字母')
    .regex(/[0-9]/, '需要包含数字'),
  displayName: z.string().min(1).max(100),
})

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number().int().positive(),
  displayName: z.string().optional(),
})

export const wechatLoginSchema = z.object({
  code: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type TokenPair = z.infer<typeof tokenPairSchema>
export type WechatLoginInput = z.infer<typeof wechatLoginSchema>
