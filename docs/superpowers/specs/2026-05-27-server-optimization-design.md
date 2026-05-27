# Server 代码优化设计

## 目标

精简后端代码，确保结构清晰、风格一致、类型安全。遵循 Hono 最佳实践和模块化设计。

## 范围

仅处理 `apps/server/` 目录，`packages/shared-types/` 做最低限度清理。

## 约束

- 文件行数上限放宽至 500 行（原 200 行）
- 拆分以避免碎片化为原则，只拆真正需要拆的
- 不引入新的依赖

---

## Step 1: 文件拆分

### 1.1 `demo-seed.ts` (597 → 2 文件)

```
src/core/services/demo-seed/
  ├── data.ts      # 静态数据：患者、事件、用药计划等初始数组
  └── index.ts     # 编排逻辑：seedDemoData() 主函数
```

`index.ts` import `data.ts` 的数据，执行数据库写入。

### 1.2 `engine.ts` (471 → 2 文件)

```
src/modules/twin/
  ├── engine.ts     # 核心：createSim / deleteSim / toggleSim / renameSim + 回调 tick
  └── operations.ts # 指标/患者/场景：addPatient / removePatient / toggleMetric / updateMetric / injectScenario / setSpeed
```

`engine.ts` 保留 Simulation Map、生命周期管理、tick 生成逻辑。
`operations.ts` 收编所有操作型函数。

### 不拆分的文件

| 文件 | 行数 | 理由 |
|------|------|------|
| `index.ts` | 367 | 在 Step 8 中通过函数内联简化 |
| `patients.ts` | 343 | 8 个端点各自短小，职责统一 |
| `twin.ts` | 340 | 拆分后 engine 和 profiles 已分离，路由保留完整 |
| `auth.ts` | 323 | 5 个端点逻辑独立，可保持 |
| `mqtt-ingest/router.ts` | 282 | 3 个 topic handler，边界清晰 |

---

## Step 2: `as any` 消除

### 2.1 数据库操作

创建 `src/core/db/helpers.ts`：

```typescript
// 集中封装所有 as any 的数据库操作
export function safeInsert(table: Parameters<typeof db.insert>[0], values: Record<string, unknown>) {
  return db.insert(table).values(values)
}

export function safeUpdate(table: Parameters<typeof db.update>[0]) {
  return db.update(table)
}
```

所有路由中的 `db.insert(x).values({...} as any)` → `safeInsert(x, {...})`
所有路由中的 `db.update(x).set({...} as any)` → `safeUpdate(x).set({...})`

### 2.2 HTTP 状态码

Hono 的 `c.json()` 原生支持 `number` 作为第二参数，当前的 `201 as any` / `404 as any` 是多余的：

```typescript
// 改前
return c.json({ error: 'Not found' }, 404 as any)

// 改后
return c.json({ error: 'Not found' }, 404)
```

全量替换所有 `status as any` → `status`。

### 2.3 其他 `as any`

- `index.ts`: `(app as any).getOpenAPIDocument()` → 使用 Hono 官方 `app.getOpenAPIDocument` 类型
- `auth.ts`: `loginFailures` 类型显式声明
- MQTT 路由中的 `EventTags` 类型声明

---

## Step 3: 死代码清理

| 删除项 | 路径 | 理由 |
|--------|------|------|
| `openapi2.json` | `apps/server/` | 170 字节空壳，无路径无 schema |
| `scripts/openapi.json` | `scripts/` | 与根 openapi.json 重复，且缺少 ema |
| `server.log` | `apps/server/` | 运行时日志不应进 git |
| `data/` 空目录 | `apps/server/src/` | 遗留目录 |
| `pkg` 导入 | `banner.ts:8` | 声明但从未使用 |
| `hasRooms()` 函数 | `index.ts:47` | 定义但从未调用 |
| `resolveValueExpr()` | `query-helpers.ts:21` | 导出但无导入方 |

---

## Step 4: 命名统一

### 4.1 路由文件名

| 改前 | 改后 |
|------|------|
| `routes/alertRules.ts` | `routes/alert-rules.ts` |

其余文件名已符合 kebab-case。

### 4.2 路由变量名

去掉 App 后缀，统一为模块名：

| 改前 | 改后 |
|------|------|
| `usersApp` | `usersRouter` |
| `patientsApp` | `patientsRouter` |
| `alertsApp` | `alertsRouter` |
| `alertRulesApp` | `alertRulesRouter` |
| `dataApp` | `dataRouter` |
| `emaApp` | `emaRouter` |
| `creditsApp` | `creditsRouter` |
| `exportApp` | `exportRouter` |
| `ingestApp` | `ingestRouter` |
| `pinsApp` | `pinsRouter` |
| `twinApp` | `twinRouter` |
| `tagsApp` | `tagsRouter` |
| `plansApp` | `plansRouter` |

`auth` 和 `dashboard` 维持原名。

### 4.3 EMA 挂载路径

`ema.ts` 挂载从 `/forms` 改为 `/ema`，与文件名保持一致。

---

## Step 5: OpenAPI 修复

### 5.1 `gen-openapi.ts`

当前缺失 `emaApp` 路由，补充 `import { emaRouter } from '../routes/ema'` 和 `app.route('/ema', emaRouter)`。

### 5.2 `scripts/openapi.json` 删除

根目录已有一份 `openapi.json`，删除脚本内的副本。

### 5.3 `index.ts` 写入方式

`(app as any).getOpenAPIDocument()` 改为使用 `@hono/zod-openapi` 提供的类型安全方法。

---

## Step 6: 类型化上下文

### 6.1 全局 Env 类型

```typescript
// src/core/http/types.ts (新文件)
export type AppEnv = {
  Variables: {
    userId: string
    userRole: string
  }
}
```

### 6.2 路由注入

所有 `new OpenAPIHono()` → `new OpenAPIHono<AppEnv>()`
所有 `c.get('userId') as string` → `c.var.userId`

### 6.3 中间件适配

`auth.ts` 和 `rbac.ts` 中的 `c.set('userId', ...)` 保持不变，类型系统自动识别。

---

## Step 7: 分页标准化

### 7.1 统一参数名

所有列表查询统一使用 `{ page, pageSize }`：

| 文件 | 改前 | 改后 |
|------|------|------|
| `data.ts` | `limit` + `offset` | `page` + `pageSize` |
| `export.ts` | `limit` | `pageSize` |
| `alerts.ts` | 已有 page/pageSize | 保持不变 |
| `patients.ts` | 已有 page/pageSize | 保持不变 |
| `credits.ts` | 已有 page/pageSize | 保持不变 |

### 7.2 分页 helper

```typescript
// src/core/db/helpers.ts 新增
export function paginateQuery<T>(qb: T, page: number, pageSize: number): T {
  return qb.limit(pageSize).offset((page - 1) * pageSize)
}
```

配合 Drizzle 的链式调用。

---

## Step 8: 全局错误处理

### 8.1 新增 `app.onError()`

在 `index.ts` 的 Hono app 上注册全局错误处理：

```typescript
import { HTTPException } from 'hono/http-exception'

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  logger.error({ err }, '未捕获异常')
  return c.json({ error: 'Internal server error' }, 500)
})
```

### 8.2 路由 404 改为抛出异常

```typescript
import { HTTPException } from 'hono/http-exception'

// 改前
if (!row) return c.json({ error: 'Not found' }, 404)

// 改后
if (!row) throw new HTTPException(404, { message: 'Not found' })
```

### 8.3 index.ts 内联优化

通过 `boot/` 模块收纳启动逻辑后，`index.ts` 从 367 行降至 ~180 行（路由挂载 + 错误处理 + bootstrap + 服务启动），保持在 500 行内。

---

## Step 9: shared-types 清理

### 9.1 删除 stale dist 产物

`packages/shared-types/dist/schemas/device.js` 和 `device.d.ts` 删除。
`packages/shared-types/dist/schemas/index.js` 和 `index.d.ts` 中移除 `./device` 重导出。

### 9.2 同步 `registerSchema`

`shared-types/src/schemas/auth.ts` 中 `displayName` 从 `min(1).max(100)` 改为 `.optional()`，匹配服务端实际行为。

### 9.3 删除未使用导出

- `packages/shared-types/src/mii-params.ts`: 删除 `RenderStrategy` 类型
- `packages/shared-types/src/schemas/twin.ts`: 删除 `mapGetSchema` 等 5 个无人导入的 schema

---

## 实施顺序

遵循依赖关系：先基础层，再上层：3 → 9 → 6 → 2 → 7 → 4 → 5 → 1 → 8

| 顺序 | Step | 原因 |
|------|------|------|
| 1 | Step 3 死代码清理 | 零风险，先做 |
| 2 | Step 9 shared-types | 独立于服务端代码 |
| 3 | Step 6 类型化上下文 | 为后续步骤提供类型基础 |
| 4 | Step 2 as any 消除 | 依赖 Step 6 的类型 |
| 5 | Step 7 分页标准化 | 可并行 |
| 6 | Step 4 命名统一 | 依赖 Step 6/2 的类型 |
| 7 | Step 5 OpenAPI | 依赖 Step 4 的命名 |
| 8 | Step 1 文件拆分 | 独立 |
| 9 | Step 8 全局错误处理 | 最后做，影响面最大 |

## 不做的

- `packages/avatar-core/` 不处理（无人引用，不影响服务端）
- MQTT 主题路由不重构（3 个 handler 边界清晰）
- 不新增 repository 层（AGENTS.md 明确"直接 Drizzle 查询"）
- 不做测试补充（本次是优化，非功能变更）
