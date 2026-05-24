import 'dotenv/config'
import { serve } from '@hono/node-server'
import { trpcServer } from '@hono/trpc-server'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { WebSocketServer } from 'ws'
import { db } from './core/db'
import { users, patients } from './core/db/schema.js'
import { hashPassword } from './core/lib/password'
import { verifyToken, type JwtPayload } from './core/lib/jwt'
import { broadcastManager } from './core/realtime/broadcast'
import { createContext } from './core/trpc/context'
import { appRouter } from './core/trpc/routers/_app'
import { env } from './env'
import { startMqttListener } from './mqtt-ingest'
import { seedPermissions } from './core/services/permission-seed'
import { seedDemoData } from './core/services/demo-seed'
import { logger } from './core/lib/logger'
import { printBanner } from './core/lib/banner'

function resolveCorsOrigins(rawCorsOrigin: string | undefined): string[] {
  if (!rawCorsOrigin) return ['http://localhost:5173']
  return rawCorsOrigin.split(',').map((origin) => origin.trim())
}

function hasRooms(value: unknown): value is { rooms: unknown[] } {
  if (!value || typeof value !== 'object') return false
  const rooms = (value as { rooms?: unknown }).rooms
  return Array.isArray(rooms) && rooms.length > 0
}

// ============================================================
// 横幅
// ============================================================
printBanner(logger)

// ============================================================
// 环境校验
// ============================================================
if (env.JWT_SECRET === 'dev-secret-change-in-production') {
  logger.warn('⚠ 使用默认 JWT_SECRET，生产环境请设置环境变量 JWT_SECRET')
}

// ============================================================
// 应用初始化
// ============================================================
const app = new Hono()

app.use(
  '/trpc/*',
  cors({
    origin: resolveCorsOrigins(env.CORS_ORIGIN),
    credentials: true,
  }),
)

app.use('/trpc/*', trpcServer({ router: appRouter, createContext }))
app.get('/health', (c) => c.json({ status: 'ok' }))

// HTTP 请求日志
app.use(
  '*',
  honoLogger((str: string) => {
    logger.info(str.replace(/\s+/g, ' ').trim())
  }),
)

// ============================================================
// 启动流程
// ============================================================
async function bootstrap() {
  // ---- 数据库连接 ----
  logger.info('正在连接数据库 ...')
  try {
    const result = await db.execute('SELECT 1 AS db_ok')
    const rows = result as unknown as { db_ok: number }[]
    if (rows?.[0]?.db_ok === 1) {
      logger.info('✓ 数据库连接成功')
    } else {
      logger.warn('⚠ 数据库返回异常响应')
    }
  } catch (err) {
    logger.error({ err }, '✗ 数据库连接失败')
    logger.error('请确认 DATABASE_URL 是否正确，PostgreSQL 是否已启动')
    process.exit(1)
  }

  // ---- 超级管理员初始化 ----
  if (env.SUPER_ADMIN_USERNAME && env.SUPER_ADMIN_PASSWORD) {
    const superAdmins = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1)
    if (superAdmins.length === 0) {
      await db.insert(users).values({
        username: env.SUPER_ADMIN_USERNAME,
        passwordHash: await hashPassword(env.SUPER_ADMIN_PASSWORD),
        displayName: env.SUPER_ADMIN_DISPLAY_NAME || '超级管理员',
        role: 'super_admin',
      })
      logger.info(`√ 超管账号已创建 (${env.SUPER_ADMIN_USERNAME})`)
    }
  } else {
    logger.warn('未配置 SUPER_ADMIN_USERNAME/PASSWORD，跳过超管初始化')
  }

  // ---- 初始数据 ----
  try {
    const patientCount = await db.select().from(patients)
    if (patientCount.length === 0) {
      await seedDemoData(db)
      logger.info('√ 初始数据已就绪 (3 位居民、体征事件、告警、用药计划)')
    }
  } catch (err) {
    logger.warn({ err }, '初始数据种子失败 (可忽略)')
  }

  // ---- 权限系统 ----
  try {
    await seedPermissions(db)
    logger.info('√ RBAC 权限已就绪')
  } catch (err) {
    logger.warn({ err }, '权限种子失败 (请先执行 db:migrate)')
  }

  // ---- 孪生引擎 ----
  try {
    const { reconstructEngine, startEngine, getEngine } = await import('./twin/engine')
    const allPatients = await db.select().from(patients)
    let engineCount = 0

    for (const patient of allPatients) {
      const tags = (patient.tags as Record<string, unknown>) || {}
      if (!hasRooms(tags.homeGraph)) continue
      if (getEngine(patient.id)) continue

      const engine = await reconstructEngine(db, {
        patientId: patient.id,
        name: patient.name,
        tags: patient.tags as Record<string, unknown>,
      })
      await startEngine(db, engine.patientId)
      engineCount++
    }
    if (engineCount > 0) {
      logger.info(`√ ${engineCount} 个数字孪生引擎已启动`)
    }
  } catch (err) {
    logger.warn({ err }, '孪生引擎自启动失败')
  }

  // ---- 虚拟 PIN 生成器 ----
  try {
    const { startAllVirtualPins } = await import('./core/trpc/routers/virtual-pin')
    await startAllVirtualPins()
    logger.info('√ 虚拟 PIN 生成器已启动')
  } catch (err) {
    logger.warn({ err }, '虚拟 PIN 启动失败')
  }
}

bootstrap().then(() => {
  // ---- MQTT ----
  if (env.MQTT_ENABLED) {
    logger.info({ broker: env.MQTT_BROKER }, '→ 正在连接 MQTT Broker ...')
    startMqttListener(env.MQTT_BROKER, {
      username: env.MQTT_USERNAME,
      password: env.MQTT_PASSWORD,
    })
  } else {
    logger.info('⊙ MQTT 未启用 (设置 MQTT_ENABLED=true 以启用)')
  }

  // ---- HTTP 服务器 ----
  const server = serve({ fetch: app.fetch, port: env.PORT })

  // ---- WebSocket ----
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
      logger.warn({ wardId, mapId }, 'WebSocket 连接被拒: 缺少 token')
      ws.close(4001, 'Unauthorized: missing token')
      return
    }

    verifyToken(token)
      .then((payload: JwtPayload) => {
        logger.info(
          { userId: payload.sub, role: payload.role, wardId, mapId },
          'WebSocket 客户端已认证',
        )

        if (wardId) {
          broadcastManager.subscribe(wardId, ws)
        }
        if (mapId) {
          broadcastManager.subscribeMap(mapId, ws)
        }

        const patientId = url.searchParams.get('patientId') || ''
        if (patientId) {
          broadcastManager.subscribePatient(patientId, ws)
          logger.info({ patientId }, 'WebSocket 已订阅居民实时数据')
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
            if (msg.type === 'subscribe_patient' && msg.patientId) {
              broadcastManager.subscribePatient(msg.patientId, ws)
            }
          } catch {
            // 忽略格式错误的消息
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
        logger.warn({ wardId, mapId }, 'WebSocket 连接被拒: token 无效')
        ws.close(4001, 'Unauthorized: invalid token')
      })
  })

  // ============================================================
  // 启动总结
  // ============================================================
  console.log('') // 空行分隔
  logger.info('══════════════════════════════════════════════')
  logger.info('  IOMTea 服务已启动')
  logger.info('══════════════════════════════════════════════')
  logger.info(`  本地地址:    http://localhost:${env.PORT}`)
  logger.info(`  健康检查:    http://localhost:${env.PORT}/health`)
  logger.info(`  tRPC 接口:   http://localhost:${env.PORT}/trpc`)
  logger.info(`  WebSocket:   ws://localhost:${env.PORT}/ws`)
  logger.info(`  CORS 白名单: ${env.CORS_ORIGIN || 'http://localhost:5173'}`)
  if (env.MQTT_ENABLED) {
    logger.info(`  MQTT Broker: ${env.MQTT_BROKER}`)
    logger.info(`  MQTT 主题:   users/+/+/+  ·  users/+/admin/+`)
  }
  logger.info(`  API 文档:    建议引入 @hono/scalar 或 @hono/swagger-ui`)
  logger.info('══════════════════════════════════════════════')
  logger.info('  使用 Ctrl+C 停止服务')
  logger.info('')
})

export type { AppRouter } from './core/trpc/routers/_app'
