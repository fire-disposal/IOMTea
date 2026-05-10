import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://localhost:5432/iomtea'),
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('2h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3000),
  MQTT_BROKER: z.string().default('mqtt://localhost:1883'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_ENABLED: z.coerce.boolean().default(false),
})

export const env = envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
