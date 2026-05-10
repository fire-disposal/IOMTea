import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { trpcServer } from '@hono/trpc-server'
import { serve } from '@hono/node-server'
import { eq } from 'drizzle-orm'
import { appRouter } from './core/trpc/routers/_app'
import { createContext } from './core/trpc/context'
import { db } from './core/db'
import { users } from './core/db/schema'
import { env } from './env'
import { startMqttIngest } from './ingest'
import { createWard } from './simulator'
import { hashPassword } from './core/lib/password'
import pino from 'pino'

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
})

const app = new Hono()

app.use('*', cors({
  origin: ['http://localhost:5173'],
  credentials: true,
}))

app.use('/trpc/*', trpcServer({ router: appRouter, createContext }))
app.get('/health', (c) => c.json({ status: 'ok' }))

// Bootstrap — demo mode
async function bootstrap() {
  if (!env.DEMO_MODE) return

  // Seed demo account
  const existing = await db.select().from(users).where(eq(users.username, 'demo')).limit(1)
  if (existing.length === 0) {
    await db.insert(users).values({
      username: 'demo',
      passwordHash: await hashPassword('demo123'),
      displayName: '演示用户',
      role: 'admin',
    })
    logger.info('demo account created (demo / demo123)')
  }

  // Auto-start demo ward (idempotent — if already running, skip)
  try {
    const ward = await createWard(db, {
      name: 'ICU 观察病房',
      patients: [
        { profileId: 'elderly-cardiac', count: 1 },
        { profileId: 'post-surgery', count: 1 },
        { profileId: 'diabetes', count: 1 },
        { profileId: 'copd-respiratory', count: 1 },
        { profileId: 'maternity', count: 1 },
      ],
      speed: 1,
    })
    logger.info({ ward: ward.name, patients: ward.patientCount }, 'demo ward auto-started')
  } catch (err) {
    logger.warn('demo ward already running or DB unavailable')
  }
}

bootstrap().then(() => {
  if (env.MQTT_ENABLED) {
    logger.info({ broker: env.MQTT_BROKER }, 'starting MQTT ingest')
    startMqttIngest(db, { broker: env.MQTT_BROKER, username: env.MQTT_USERNAME, password: env.MQTT_PASSWORD })
  }
  logger.info({ port: env.PORT, demo: env.DEMO_MODE }, 'server ready')
  serve({ fetch: app.fetch, port: env.PORT })
})

export type { AppRouter } from './core/trpc/routers/_app'
