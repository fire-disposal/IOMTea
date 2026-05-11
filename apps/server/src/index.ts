import { serve } from '@hono/node-server'
import { trpcServer } from '@hono/trpc-server'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import pino from 'pino'
import { WebSocketServer } from 'ws'
import { db } from './core/db'
import { mapConfigs, users } from './core/db/schema'
import { hashPassword } from './core/lib/password'
import { broadcastManager } from './core/realtime/broadcast'
import { createContext } from './core/trpc/context'
import { appRouter } from './core/trpc/routers/_app'
import { env } from './env'
import { startMqttIngest, startTcpIngest } from './ingest'
import { createWard } from './simulator'

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
})

if (env.JWT_SECRET === 'dev-secret-change-in-production') {
  logger.warn('Using default JWT_SECRET - set JWT_SECRET in production!')
}

const app = new Hono()

app.use(
  '/trpc/*',
  cors({
    origin: env.CORS_ORIGIN
      ? env.CORS_ORIGIN.split(',').map((s) => s.trim())
      : ['http://localhost:5173'],
    credentials: true,
  }),
)

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

  // Seed default map config
  try {
    const existingMap = await db.select().from(mapConfigs).where(eq(mapConfigs.id, 'default')).limit(1)
    if (existingMap.length === 0) {
      await db.insert(mapConfigs).values({
        id: 'default',
        data: {
          id: 'default', width: 15, height: 13, tileSize: 1,
          zones: [],
          entities: [],
        },
      })
      logger.info('default map config seeded')
    }
  } catch (err) {
    logger.warn({ err }, 'map config seed failed (run db:migrate first)')
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
    logger.warn({ err }, 'demo ward auto-start failed')
  }
}

bootstrap().then(() => {
  if (env.MQTT_ENABLED) {
    logger.info({ broker: env.MQTT_BROKER }, 'starting MQTT ingest')
    startMqttIngest(db, {
      broker: env.MQTT_BROKER,
      username: env.MQTT_USERNAME,
      password: env.MQTT_PASSWORD,
    })
  }

  if (env.TCP_INGEST_ENABLED) {
    logger.info({ port: env.TCP_INGEST_PORT }, 'starting TCP ingest')
    startTcpIngest(db, { port: env.TCP_INGEST_PORT, preSharedToken: env.TCP_INGEST_TOKEN })
  }

  const server = serve({ fetch: app.fetch, port: env.PORT })
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    } else {
      socket.destroy()
    }
  })

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const wardId = url.searchParams.get('wardId') || ''

    if (wardId) {
      broadcastManager.subscribe(wardId, ws)
      logger.info({ wardId }, 'websocket client subscribed')
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.type === 'subscribe' && msg.wardId) {
          broadcastManager.subscribe(msg.wardId, ws)
          logger.info({ wardId: msg.wardId }, 'websocket client subscribed (message)')
        }
      } catch {
        // ignore malformed messages
      }
    })

    ws.on('close', () => {
      broadcastManager.unsubscribeAll(ws)
    })

    ws.on('error', () => {
      broadcastManager.unsubscribeAll(ws)
    })
  })

  logger.info({ port: env.PORT, demo: env.DEMO_MODE, ws: true }, 'server ready')
})

export type { AppRouter } from './core/trpc/routers/_app'
