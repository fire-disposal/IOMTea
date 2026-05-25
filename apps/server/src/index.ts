import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { WebSocketServer } from 'ws'
import { db } from './core/db'
import { patients, users } from './core/db/schema.js'
import { printBanner } from './core/lib/banner'
import { type JwtPayload, verifyToken } from './core/lib/jwt'
import { logger } from './core/lib/logger'
import { hashPassword } from './core/lib/password'
import { broadcastManager } from './core/realtime/broadcast'
import { seedDemoData } from './core/services/demo-seed'
import { seedPermissions } from './core/services/permission-seed'
import { env } from './env'
import { startMqttListener } from './mqtt-ingest'
import './core/pipeline/registry'

import { alertRulesApp } from './routes/alertRules'
import { alertsApp } from './routes/alerts'
// ── REST Route imports ──
import { auth } from './routes/auth'
import { dashboard } from './routes/dashboard'
import { dataApp } from './routes/data'
import { exportApp } from './routes/export'
import { ingestApp } from './routes/ingest'
import { patientsApp } from './routes/patients'
import { pinsApp } from './routes/pins'
import { tagsApp } from './routes/tags'
import { twinApp } from './routes/twin'
import { usersApp } from './routes/users'
import { plansApp } from './routes/plans'
import { creditsApp } from './routes/credits'

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
const app = new OpenAPIHono()

// Global CORS
app.use(
  '*',
  cors({
    origin: resolveCorsOrigins(env.CORS_ORIGIN),
    credentials: true,
  }),
)

// HTTP 请求日志
app.use(
  '*',
  honoLogger((str: string) => {
    logger.info(str.replace(/\s+/g, ' ').trim())
  }),
)

// ── REST API routes ──
app.route('/auth', auth)
app.route('/users', usersApp)
app.route('/dashboard', dashboard)
app.route('/pins', pinsApp)
app.route('/tags', tagsApp)
app.route('/patients', patientsApp)
app.route('/alerts', alertsApp)
app.route('/alert-rules', alertRulesApp)
app.route('/ingest', ingestApp)
app.route('/data', dataApp)
app.route('/export', exportApp)
app.route('/twin', twinApp)
app.route('/plans', plansApp)
app.route('/credits', creditsApp)

// OpenAPI spec (auto-collects from all mounted OpenAPIHono sub-apps)
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'IOMTea API',
    version: '2.0.0',
    description: 'Home health IoT monitoring platform — REST API',
  },
})

// Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }))

app.get('/health', (c) => c.json({ status: 'ok' }))

// Root: API info
app.get('/', (c) =>
  c.json({
    name: 'IOMTea API',
    version: '2.0.0',
    docs: `/docs`,
    openapi: `/openapi.json`,
    health: `/health`,
    endpoints: {
      auth: '/auth',
      users: '/users',
      dashboard: '/dashboard',
      patients: '/patients',
      alerts: '/alerts',
      pins: '/pins',
      data: '/data',
      ingest: '/ingest',
      export: '/export',
      twin: '/twin',
    },
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
  // (managed via REST /twin routes, no auto-start)
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
  // OpenAPI JSON 导出（写入项目目录供代码生成使用）
  // ============================================================
  try {
    const partialDoc = (app as any).getOpenAPIDocument()
    const doc = {
      openapi: '3.0.0',
      info: { title: 'IOMTea API', version: '2.0.0', description: 'Home health IoT monitoring' },
      ...partialDoc,
    }
    const outPath = path.resolve(import.meta.dirname, '..', 'openapi.json')
    fs.writeFileSync(outPath, JSON.stringify(doc, null, 2), 'utf-8')
    logger.info(`√ OpenAPI 文档已写入: ${outPath}`)
  } catch (err) {
    logger.warn({ err }, 'OpenAPI 文档写入失败')
  }

  // ============================================================
  // 启动总结
  // ============================================================
  console.log('') // 空行分隔
  logger.info('══════════════════════════════════════════════')
  logger.info('  IOMTea 服务已启动')
  logger.info('══════════════════════════════════════════════')
  logger.info(`  本地地址:    http://localhost:${env.PORT}`)
  logger.info(`  健康检查:    http://localhost:${env.PORT}/health`)
  logger.info(`  REST API:    http://localhost:${env.PORT}`)
  logger.info(`  API 文档:    http://localhost:${env.PORT}/docs`)
  logger.info(`  OpenAPI:     http://localhost:${env.PORT}/openapi.json`)
  logger.info(`  WebSocket:   ws://localhost:${env.PORT}/ws`)
  logger.info(`  CORS 白名单: ${env.CORS_ORIGIN || 'http://localhost:5173'}`)
  if (env.MQTT_ENABLED) {
    logger.info(`  MQTT Broker: ${env.MQTT_BROKER}`)
    logger.info(`  MQTT 主题:   users/+/+/+  ·  users/+/admin/+`)
  }
  logger.info('══════════════════════════════════════════════')
  logger.info('  使用 Ctrl+C 停止服务')
  logger.info('')
})
