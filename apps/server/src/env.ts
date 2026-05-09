import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://localhost:5432/iomtea'),
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('2h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3000),
})

export const env = envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
