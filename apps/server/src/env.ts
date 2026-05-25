import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@127.0.0.1:5432/iomtea'),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters')
    .default('dev-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('2h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3000),
  MQTT_BROKER: z.string().default('mqtt://localhost:1883'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_ENABLED: z.coerce.boolean().default(true),
  SUPER_ADMIN_USERNAME: z.string().optional(),
  SUPER_ADMIN_PASSWORD: z
    .string()
    .min(8, 'SUPER_ADMIN_PASSWORD must be at least 8 characters')
    .optional(),
  SUPER_ADMIN_DISPLAY_NAME: z.string().default('超级管理员'),
  TCP_INGEST_PORT: z.coerce.number().optional(),
  TCP_INGEST_TOKEN: z.string().optional(),
  WECHAT_APP_ID: z.string().optional(),
  WECHAT_APP_SECRET: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
})

export const env = envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
