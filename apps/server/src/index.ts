import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { trpcServer } from '@hono/trpc-server'
import { serve } from '@hono/node-server'
import { appRouter } from './core/trpc/routers/_app'
import { createContext } from './core/trpc/context'
import { db } from './core/db'
import { env } from './env'
import { startMqttIngest } from './ingest'
import pino from 'pino'

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
})

const app = new Hono()

app.use('*', cors({
  origin: ['http://localhost:5173'],
  credentials: true,
}))

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  }),
)

app.get('/health', (c) => c.json({ status: 'ok' }))

if (env.MQTT_ENABLED) {
  logger.info({ broker: env.MQTT_BROKER }, 'starting MQTT ingest')
  startMqttIngest(db, {
    broker: env.MQTT_BROKER,
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
  })
}

logger.info({ port: env.PORT }, 'starting server')
serve({ fetch: app.fetch, port: env.PORT })

export type { AppRouter } from './core/trpc/routers/_app'
