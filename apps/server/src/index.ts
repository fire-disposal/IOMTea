import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
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
import { requestId } from './middleware/request-id'
import { startMqttListener } from './mqtt-ingest'
import './core/pipeline/registry'

import { alertRulesRouter } from './routes/alert-rules'
import { alertsRouter } from './routes/alerts'
// ── REST Route imports ──
import { auth } from './routes/auth'
import { creditsRouter } from './routes/credits'
import { dashboard } from './routes/dashboard'
import { dataRouter } from './routes/data'
import { emaRouter } from './routes/ema'
import { exportRouter } from './routes/export'
import { ingestRouter } from './routes/ingest'
import { patientsRouter } from './routes/patients'
import { pinsRouter } from './routes/pins'
import { plansRouter } from './routes/plans'
import { tagsRouter } from './routes/tags'
import { twinRouter } from './routes/twin'
import { usersRouter } from './routes/users'

function resolveCorsOrigins(rawCorsOrigin: string | undefined): string[] {
  if (!rawCorsOrigin) return ['http://localhost:5173']
  return rawCorsOrigin.split(',').map((origin) => origin.trim())
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

// 请求ID中间件 (x-request-id)
app.use('*', requestId)

// 全局错误处理
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  logger.error({ err }, '未捕获异常')
  return c.json({ error: 'Internal server error' }, 500)
})

// ── REST API routes ──
app.route('/auth', auth)
app.route('/users', usersRouter)
app.route('/dashboard', dashboard)
app.route('/pins', pinsRouter)
app.route('/tags', tagsRouter)
app.route('/patients', patientsRouter)
app.route('/alerts', alertsRouter)
app.route('/alert-rules', alertRulesRouter)
app.route('/ingest', ingestRouter)
app.route('/data', dataRouter)
app.route('/export', exportRouter)
app.route('/twin', twinRouter)
app.route('/plans', plansRouter)
app.route('/credits', creditsRouter)
app.route('/ema', emaRouter)

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

app.get('/health', async (c) => {
  try {
    await db.execute('SELECT 1')
    return c.json({ status: 'ok', db: 'connected' })
  } catch {
    return c.json({ status: 'degraded', db: 'disconnected' }, 503)
  }
})

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
      ema: '/ema',
      plans: '/plans',
      credits: '/credits',
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
    await seedPermissions()
    logger.info('√ RBAC 权限已就绪')
  } catch (err) {
    logger.warn({ err }, '权限种子失败 (请先执行 db:migrate)')
  }

  // ---- 孪生引擎 ----
  // (managed via REST /twin routes, no auto-start)
}

bootstrap().then(() => {
  // ---- MQTT ----
  if (env.MQTT_ENABLED && env.MQTT_BROKER) {
    logger.info(`→ 正在连接 MQTT Broker ... (${env.MQTT_BROKER})`)
    try {
      startMqttListener(env.MQTT_BROKER, {
        username: env.MQTT_USERNAME,
        password: env.MQTT_PASSWORD,
      })
    } catch (err) {
      logger.warn({ err }, 'MQTT 启动失败，服务将继续运行')
    }
  } else if (env.MQTT_ENABLED) {
    logger.warn('MQTT 已启用但未配置 MQTT_BROKER，跳过')
  } else {
    logger.info('MQTT 未启用')
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

  // ── Graceful shutdown ──
  const shutdown = () => {
    logger.info('正在关闭服务 ...')
    import('./mqtt-ingest').then((m) => m.stopMqttListener?.()).catch(() => {})
    wss.close(() => {
      server.close(() => {
        logger.info('服务已关闭')
        process.exit(0)
      })
    })
    // Force exit after 10s
    setTimeout(() => {
      logger.warn('强制退出 (超时)')
      process.exit(1)
    }, 10000)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('SIGHUP', shutdown)
})
