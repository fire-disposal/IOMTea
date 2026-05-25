# REST + OpenAPI 迁移设计草案

> 日期：2026-05-25
> 状态：草案（待后端整改完成后执行）
> 目标：tRPC 替换为 Hono REST + `@hono/zod-openapi` + 自动生成客户端

## 1. 动机

当前 tRPC 在多端场景下存在结构性摩擦：

| 问题 | 表现 | 根因 |
|------|------|------|
| Web mutation 传 props | `create: any` / `update: any` 阻断类型 | tRPC hooks 不鼓励 prop drilling |
| 小程序客户端退化 | `createTRPCClient<any>` 无类型 | Taro 无 React Query，无 hook |
| Flutter 无类型接入 | 手写 HTTP 请求 | tRPC 无 Dart 客户端 |
| 无 API 文档 | 团队间只能看源码猜接口 | tRPC 无内建 OpenAPI |

## 2. 方案

### 技术选型

| 层 | 技术 | 说明 |
|----|------|------|
| Server 路由 | Hono (`app.route()`) | 已用 Hono，仅扩展 |
| 校验 | Zod (保持 v3) | 复用现有 schema，不加 `.openapi()` |
| OpenAPI 生成 | `zod-to-openapi` 脚本 | 手写转换脚本，避免升 zod v4 |
| Web 客户端 | 手写类型 + fetch 封装 | 基于 `z.infer` 推断请求/响应类型 |
| 小程序客户端 | 同 Web 类型 | Taro request 适配 |
| Flutter | 保持 MQTT 为主 | 不在迁移范围 |

### 类型安全恢复路径

```
Zod schema (.openapi() 标注)
  → OpenAPI spec (自动生成 JSON)
  → openapi-typescript (生成 .d.ts)
  → openapi-fetch (类型安全 fetch 客户端)
  → Web / Miniapp / Flutter 全部受益
```

对比现在：
```
Zod schema
  → tRPC 类型推断
  → Web ✓ / Miniapp ✗ (any) / Flutter ✗ (手动)
```

## 3. 路由设计

103 个 tRPC procedure 合并为 ~55 条 REST 路由。

### 资源路由映射

```
# 患者
GET    /patients                    → patient.list
POST   /patients                    → patient.create
GET    /patients/:id                → patient.byId
PATCH  /patients/:id                → patient.update
DELETE /patients/:id                → patient.delete
POST   /patients/bulk               → patient.bulkCreate
PATCH  /patients/bulk/status        → patient.bulkUpdateStatus
GET    /patients/:id/users          → patient.linkedUsers
POST   /patients/:id/users          → patient.linkUser
DELETE /patients/:id/users/:userId  → patient.unlinkUser
GET    /patients/:id/tags           → (from patient.tags)
POST   /patients/:id/tags           → patient.bulkAddTags

# 告警
GET    /alerts                      → alert.list
PATCH  /alerts/:id                  → alert.acknowledge/resolve/assign (body action)
POST   /alerts/:id/handle           → alert.handle
POST   /alerts/:id/close            → alert.close

# 告警规则
GET    /patients/:id/alert-rules    → alertRule.byPatient
PUT    /patients/:id/alert-rules    → alertRule.upsert

# 用药
GET    /medications                 → medication.list + listAll (query: ?patientId=)
POST   /medications                 → medication.create
GET    /medications/:id             → medication.byId
PATCH  /medications/:id             → medication.update
DELETE /medications/:id             → medication.delete
GET    /medications/:id/schedules   → medication.schedules
POST   /medications/:id/schedules   → medication.createSchedule
GET    /schedules/:id/adherence     → medication.adherence
POST   /schedules/:id/taken         → medication.markTaken
POST   /schedules/:id/missed        → medication.markMissed

# 数据
GET    /data/timeseries             → data.timeseries
GET    /data/timeseries-batch       → data.timeseriesBatch
GET    /data/latest                 → data.latest

# PIN 管理
GET    /pins                        → pin.list
POST   /pins                        → pin.create
GET    /pins/:code                  → pin.byPin
PATCH  /pins/:code                  → pin.update
DELETE /pins/:code                  → pin.delete/revoke
POST   /pins/:code/reset            → pin.resetPin

# 户型图 / 节点图
GET    /patients/:id/home-graph     → homeGraph.get
PUT    /patients/:id/home-graph     → homeGraph.upsert
POST   /rooms/events                → homeGraph.reportDeviceEvent (public, PIN auth)
GET    /node-graph                  → nodeGraph.getGraph
PUT    /node-graph                  → nodeGraph.saveGraph
PATCH  /devices/:id/room            → nodeGraph.assignDevice
DELETE /rooms/:id                   → nodeGraph.deleteRoom

# 认证 (public)
POST   /auth/register               → auth.register
POST   /auth/login                  → auth.login
POST   /auth/refresh                → auth.refresh
POST   /auth/wechat-login           → auth.wechatLogin

# 用户管理
GET    /users                       → user.list
GET    /users/me                    → user.me
PATCH  /users/:id                   → user.update

# 仪表盘
GET    /dashboard/summary           → dashboard.summary

# 标签
GET    /tags                        → tag.list
POST   /tags                        → tag.create
PATCH  /tags/:id                    → tag.update
DELETE /tags/:id                    → tag.delete

# 健康记录
POST   /health-records              → healthRecords.batchCreate

# 积分 / 打卡 / 计划 / 清单
GET    /credit                      → credit.get
GET    /credit/transactions         → credit.transactions
GET    /streak                      → streak.get
GET    /plans                       → plan.list
POST   /plans                       → plan.create
POST   /plans/:id/activate          → plan.activate
GET    /checklist/today             → checklist.today
PATCH  /checklist/:id               → checklist.toggle

# 导出
GET    /export/:entity              → export.download (query: ?format=csv|xlsx)

# 虚拟 PIN
GET    /virtual-pins                → virtualPin.list
POST   /virtual-pins                → virtualPin.create
PATCH  /virtual-pins/:id            → virtualPin.update

# 模拟 (sim + twin + simulation)
GET    /sim/configs                 → sim.configs
POST   /sim/configs                 → sim.createConfig
PATCH  /sim/configs/:id             → sim.updateConfig
DELETE /sim/configs/:id             → sim.deleteConfig
POST   /sim/configs/:id/start       → sim.start
POST   /sim/configs/:id/stop        → sim.stop
GET    /sim/patients                → sim.patients
POST   /sim/patients                → sim.linkPatient
GET    /twin/engines                → twin.listEngines
POST   /twin/start                  → twin.startEngine
POST   /twin/stop                   → twin.stopEngine
POST   /twin/scenario               → twin.injectScenario
GET    /simulation/profiles         → simulation.listProfiles
GET    /simulation/configs          → simulation.listConfigs
POST   /simulation/configs          → simulation.createConfig
PATCH  /simulation/configs/:id      → simulation.updateConfig
```

## 4. 实现细节

### 4.1 Zod Schema 适配

```typescript
// packages/shared-types/src/schemas/patient.ts
import { z } from '@hono/zod-openapi'

export const patientCreateSchema = z.object({
  name: z.string().min(1).openapi({ example: '张三' }),
  gender: z.enum(['male', 'female', 'other']).openapi({ example: 'male' }),
  birthDate: z.string().optional().openapi({ example: '1960-01-01' }),
  // ...
}).openapi({ ref: 'PatientCreate' })
```

### 4.2 Hono 路由示例

```typescript
// apps/server/src/routes/patients.ts
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { patientCreateSchema, patientSchema } from '@iomtea/shared-types'

const patients = new OpenAPIHono()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ bearerAuth: [] }],
  request: { query: patientListInputSchema },
  responses: { 200: { content: { 'application/json': { schema: z.array(patientSchema) } } } },
})

patients.openapi(listRoute, async (c) => {
  const query = c.req.valid('query')
  const result = await patientService.list(db, query)
  return c.json(result, 200)
})
```

### 4.3 Auth 中间件

```typescript
// apps/server/src/middleware/auth.ts (Hono middleware)
import { bearerAuth } from 'hono/bearer-auth'
import { verifyToken } from '../core/lib/jwt'

export const jwtAuth = bearerAuth({
  verifyToken: async (token, c) => {
    const payload = await verifyToken(token)
    c.set('userId', payload.sub)
    c.set('userRole', payload.role)
    return true
  },
})

export function requirePermission(...codes: string[]) {
  return createMiddleware(async (c, next) => {
    const role = c.get('userRole')
    const hasPermission = await checkRolePermissions(c.get('db'), role, codes)
    if (!hasPermission) return c.json({ error: 'Forbidden' }, 403)
    await next()
  })
}
```

### 4.4 Web 客户端

```typescript
// apps/web/src/api/client.ts
import createClient from 'openapi-fetch'
import type { paths } from './types'  // generated by openapi-typescript
import { getToken, refreshToken } from '../store/auth'

export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE,
  headers: () => {
    const token = getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
})

// 自动 token refresh 在 fetch 中间件处理
api.use({
  async onResponse({ response }) {
    if (response.status === 401) {
      await refreshToken()
    }
  }
})

// 使用示例
const { data, error } = await api.GET('/patients', { params: { query: { page: 1 } } })
const { data: patient } = await api.GET('/patients/{id}', { params: { path: { id: '...' } } })
```

### 4.5 小程序客户端

```typescript
// apps/miniapp/src/api/client.ts
import Taro from '@tarojs/taro'
import createClient from 'openapi-fetch'
import type { paths } from './types'

const taroFetch = (url: string, init: RequestInit) => {
  return new Promise((resolve, reject) => {
    Taro.request({
      url,
      method: init.method as any,
      header: init.headers as Record<string, string>,
      data: init.body ? JSON.parse(init.body as string) : undefined,
      success: (res) => resolve(new Response(JSON.stringify(res.data), { status: res.statusCode })),
      fail: (err) => reject(err),
    })
  })
}

export const api = createClient<paths>({
  baseUrl: getApiBase(),
  fetch: taroFetch,
  headers: () => {
    const token = Taro.getStorageSync('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
})
```

### 4.6 项目结构变化

```
apps/server/src/
  routes/                    # 新增：Hono REST 路由
    patients.ts
    alerts.ts
    medications.ts
    data.ts
    pins.ts
    auth.ts
    users.ts
    dashboard.ts
    ...
  middleware/                 # 改成 Hono 中间件
    auth.ts
    rbac.ts
  core/trpc/                 # 保留至迁移完成，标记 @deprecated

apps/web/src/
  api/
    client.ts                # openapi-fetch 客户端
    types.ts                 # 自动生成，.gitignore

apps/miniapp/src/
  api/
    client.ts                # Taro 适配的 openapi-fetch
    types.ts                 # 共享类型文件

packages/shared-types/src/
  schemas/                   # Zod + .openapi() 元数据
```

## 5. 迁移策略（直接切换）

### 5.1 执行顺序

Server → Web → 清理，不做双栈过渡。

### 5.2 任务列表

| # | 任务 | 涉及文件 | 耗时 |
|---|------|---------|------|
| 1 | Shared Zod schemas → `.openapi()` 标注 | `packages/shared-types/src/schemas/*.ts` (7 文件) | 2h |
| 2 | Hono auth middleware | `apps/server/src/middleware/auth.ts` [新] | 1h |
| 3 | Hono RBAC middleware | `apps/server/src/middleware/rbac.ts` [新] | 1h |
| 4 | 生成 OpenAPI spec 端点 | `apps/server/src/routes/openapi.ts` [新] | 1h |
| 5 | REST 路由实现 (55 条) | `apps/server/src/routes/*.ts` [新] | 30h |
| 6 | 生成 TypeScript 客户端类型 | `apps/web/src/api/types.ts` [生成] | 1h |
| 7 | Web API client 封装 | `apps/web/src/api/client.ts` [新] | 1h |
| 8 | Web 22 页面替换 tRPC → REST | `apps/web/src/pages/*.tsx` | 23h |
| 9 | 路由组件中去掉 tRPC imports | `apps/web/src/routes.tsx`, `__root.tsx` | 1h |
| 10 | 删除旧 tRPC 代码 | `core/trpc/`, `web/src/trpc.ts` 等 | 2h |
| 11 | 验证 + lint + typecheck | 全量 | 3h |

### 5.3 不做双栈的理由

- 共享同一组 Zod schema 和 service 层，REST 路由只是另一层薄封装
- tRPC 的 `.input()` 和 REST 的 `c.req.valid()` 可同时从同一 Zod schema 工作
- 先建完 REST 路由 → 改 Web → 删 tRPC，中间不部署

## 6. 风险评估

| 风险 | 等级 | 缓解 |
|------|------|------|
| Schema 不一致 | 中 | REST 路由直接用现有 Zod schema + `.openapi()`，验证逻辑一致 |
| WebSocket 不受影响 | 低 | WS 独立于 tRPC/REST |
| 小程序 fetch 适配 | 低 | 已有 taroFetcher 经验 |
| 批量操作事务 | 低 | 使用 Hono middleware + Drizzle transaction |
| `reportDeviceEvent` PIN 认证 | 低 | 自定义 middleware 处理 |

## 7. 时间估计

| 阶段 | 任务 | 工时 |
|------|------|------|
| 准备 | 75 inline Zod → `.openapi()` 标注 | 8h |
| 准备 | 16 shared Zod → `.openapi()` 标注 | 2h |
| 准备 | Hono auth/rbac middleware 改写 | 4h |
| S1 | 55 REST 路由实现 | 30h |
| S1 | OpenAPI spec 生成端点 + 测试 | 3h |
| S1 | 类型生成脚本配置 | 2h |
| S2 | Web 22 页面迁移 | 23h |
| S2 | 小程序 12 页面 + client 迁移 | 8h |
| S2 | Flutter Dart client 生成 | 5h |
| S3 | 旧代码清理 + 验证 | 5h |
| | **总计** | **~90h** |
