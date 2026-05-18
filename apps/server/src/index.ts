import { serve } from '@hono/node-server'
import { trpcServer } from '@hono/trpc-server'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import pino from 'pino'
import { WebSocketServer } from 'ws'
import { db } from './core/db'
import { users } from './core/db/schema'
import { hashPassword } from './core/lib/password'
import { verifyToken, type JwtPayload } from './core/lib/jwt'
import { broadcastManager } from './core/realtime/broadcast'
import { createContext } from './core/trpc/context'
import { appRouter } from './core/trpc/routers/_app'
import { env } from './env'
import { startMqttListener } from './mqtt-ingest'
import { seedPermissions } from './core/services/permission-seed'

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

// Bootstrap — seed demo account, default map, auto-start ward
async function bootstrap() {
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

  // Seed RBAC permissions
  try {
    await seedPermissions(db)
    logger.info('rbac permissions seeded')
  } catch (err) {
    logger.warn({ err }, 'permission seed failed (run db:migrate first)')
  }

  // Auto-start engines for all patients with homeGraph
  try {
    const { reconstructEngine, startEngine, getEngine } = await import('./twin/engine')
    const { patients } = await import('./core/db/schema')
    const allPatients = await db.select().from(patients)

    for (const patient of allPatients) {
      const tags = (patient.tags as Record<string, unknown>) || {}
      const homeGraph = tags.homeGraph as any
      if (!homeGraph?.rooms?.length) continue
      if (getEngine(patient.id)) continue

      const engine = await reconstructEngine(db, {
        patientId: patient.id,
        name: patient.name,
        tags: patient.tags as Record<string, unknown>,
      })
      await startEngine(db, engine.patientId)
      logger.info({ patientId: engine.patientId, name: patient.name }, 'engine auto-started')
    }
  } catch (err) {
    logger.warn({ err }, 'engine auto-start failed')
  }
}

bootstrap().then(() => {
  if (env.MQTT_ENABLED) {
    logger.info({ broker: env.MQTT_BROKER }, 'starting MQTT PIN listener')
    startMqttListener(env.MQTT_BROKER, {
      username: env.MQTT_USERNAME,
      password: env.MQTT_PASSWORD,
    })
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
    const mapId = url.searchParams.get('mapId') || ''
    const token = url.searchParams.get('token') || ''

    if (!token) {
      logger.warn({ wardId, mapId }, 'websocket connection rejected: missing token')
      ws.close(4001, 'Unauthorized: missing token')
      return
    }

    verifyToken(token)
      .then((payload: JwtPayload) => {
        logger.info({ userId: payload.sub, role: payload.role, wardId, mapId }, 'websocket client authenticated')

        if (wardId) {
          broadcastManager.subscribe(wardId, ws)
        }

        if (mapId) {
          broadcastManager.subscribeMap(mapId, ws)
        }

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString())
            if (msg.type === 'subscribe' && msg.wardId) {
              broadcastManager.subscribe(msg.wardId, ws)
            }
            if (msg.type === 'subscribe_twin' && msg.mapId) {
              broadcastManager.subscribeMap(msg.mapId, ws)
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
      .catch(() => {
        logger.warn({ wardId, mapId }, 'websocket connection rejected: invalid token')
        ws.close(4001, 'Unauthorized: invalid token')
      })
  })

  logger.info({ port: env.PORT, ws: true }, 'server ready')
})

export type { AppRouter } from './core/trpc/routers/_app'
