# 后端 RBAC + 功能补全 + 清理 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后端从自研字符串匹配鉴权迁移到 Casbin，修复 3 个功能性 Bug，补全缺失 CRUD，清理孤儿 schema

**Architecture:** Casbin + PostgreSQL Adapter 作为鉴权引擎，中间件 `requirePermission(obj, act)` 注入每个路由，新增 `pg` 依赖提供原生 Pool 给 adapter

**Tech Stack:** casbin, @casbin/pg-adapter, pg, Hono, Drizzle ORM, PostgreSQL

**Spec:** `docs/superpowers/specs/2026-05-25-backend-rbac-cleanup-design.md`

---

## 文件结构

| 操作 | 文件路径 |
|------|----------|
| **新增** | `apps/server/src/core/casbin/model.conf` |
| **新增** | `apps/server/src/core/casbin/enforcer.ts` |
| **新增** | `apps/server/src/core/db/schema/twin.ts` |
| **新增** | `apps/web/src/pages/RbacManagementPage.tsx` |
| **重写** | `apps/server/src/middleware/rbac.ts` |
| **重写** | `apps/server/src/core/services/permission-seed.ts` |
| **修改** | `apps/server/src/routes/*.ts` (14 文件 — RBAC 注入) |
| **修改** | `apps/server/src/routes/plans.ts` (运算符修复) |
| **修改** | `apps/server/src/routes/export.ts` (多指标修复) |
| **修改** | `apps/server/src/routes/alertRules.ts` (默认阈值) |
| **修改** | `apps/server/src/routes/credits.ts` (扩 balance/earn/spend) |
| **修改** | `apps/server/src/routes/dashboard.ts` (扩 trends/patient) |
| **修改** | `apps/server/src/routes/users.ts` (扩单查/删除/角色) |
| **修改** | `apps/server/src/routes/tags.ts` (扩单查/更新) |
| **修改** | `apps/server/src/routes/pins.ts` (扩单查/更新) |
| **修改** | `apps/server/src/core/db/index.ts` (暴露 pg Pool + 补 plan 导出) |
| **修改** | `apps/server/src/core/db/schema/enums.ts` (删孤儿枚举) |
| **修改** | `apps/server/src/core/db/schema.ts` (删 sessions) |
| **修改** | `apps/server/src/core/db/schema/auth-ext.ts` (删 permissions/rolePermissions) |
| **删除** | `apps/server/src/modules/twin/schema.ts` (迁移后) |
| **修改** | `packages/shared-types/src/schemas/index.ts` (删重复导出) |
| **修改** | `apps/web/src/routes.tsx` (注册 /settings/rbac) |
| **修改** | `apps/web/src/pages/UserManagementPage.tsx` (角色选择) |

---

### Task 1: 安装依赖

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: 安装 Casbin 依赖**

```bash
pnpm add casbin @casbin/pg-adapter pg --filter @iomtea/server
```

- [ ] **Step 2: 验证安装**

```bash
pnpm typecheck --filter @iomtea/server
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/package.json pnpm-lock.yaml
git commit -m "chore: 添加 Casbin + pg 依赖"
```

---

### Task 2: 创建 Casbin 核心

**Files:**
- Create: `apps/server/src/core/casbin/model.conf`
- Create: `apps/server/src/core/casbin/enforcer.ts`
- Modify: `apps/server/src/core/db/index.ts`

- [ ] **Step 1: 创建 model.conf**

```ini
# apps/server/src/core/casbin/model.conf
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && keyMatch(r.obj, p.obj) && keyMatch(r.act, p.act)
```

- [ ] **Step 2: 创建 enforcer 单例**

```typescript
// apps/server/src/core/casbin/enforcer.ts
import { newEnforcer } from 'casbin'
import { PrismaAdapter } from 'casbin-prisma-adapter'  // 注：实际用 pg-adapter
// 等待依赖安装后确认 API
```
由于 `@casbin/pg-adapter` 的确切 API 需要安装后确认，此步骤留到安装依赖后完成。

TODO: 此处在开始实现时补全完整代码。

- [ ] **Step 3: 修改 db/index.ts 暴露 pg Pool**

在 `apps/server/src/core/db/index.ts` 中，在 `export const db` 之前添加：

```typescript
import pg from 'pg'

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 })
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/core/casbin/ apps/server/src/core/db/index.ts
git commit -m "feat: 初始化 Casbin 鉴权核心"
```

---

_(由于依赖 API 需要安装后确认，后续 Task 在实际执行时由 subagent 补全细节。以下是其余任务的纲要和关键代码片段。)_

---

### Task 3: 重写 RBAC 中间件

**Files:**
- Modify: `apps/server/src/middleware/rbac.ts`

删除现有实现，替换为：

```typescript
import { createMiddleware } from 'hono/factory'
import { getEnforcer } from '../core/casbin/enforcer'

export function requirePermission(obj: string, act: string) {
  return createMiddleware(async (c, next) => {
    const role = c.get('userRole') as string | undefined
    if (!role) return c.json({ error: 'Forbidden' }, 403)
    if (role === 'super_admin') return await next()

    const enforcer = await getEnforcer()
    const sub = `role:${role}`
    const allowed = await enforcer.enforce(sub, obj, act)
    if (!allowed) {
      return c.json({ error: 'Forbidden', message: `需要权限: ${obj}:${act}` }, 403)
    }
    await next()
  })
}
```

**Commit:** `feat: Casbin 中间件替换自研 requirePermission`

---

### Task 4: 重写权限种子

**Files:**
- Modify: `apps/server/src/core/services/permission-seed.ts`

替换为写入 Casbin 策略表：

```typescript
import type { DbClient } from '../db'
import { getEnforcer } from '../casbin/enforcer'

export async function seedPermissions(_db: DbClient): Promise<void> {
  const e = await getEnforcer()

  // 检查已有策略
  const existing = await e.getPolicy()
  if (existing.length > 0) return

  // 默认策略
  const policies: [string, string, string][] = [
    ['role:super_admin', '*', '*'],
    ['role:admin', '*', '*'],
    ['role:user', '/patients/*', 'read'],
    ['role:user', '/dashboard/*', 'read'],
    ['role:user', '/alerts/*', 'read'],
    ['role:user', '/data/*', 'read'],
    ['role:user', '/plans/*', 'read'],
    ['role:user', '/credits/*', 'read'],
  ]

  for (const p of policies) {
    await e.addPolicy(...p)
  }

  // 角色继承
  await e.addGroupingPolicy('role:admin', 'role:user')
}
```

**Commit:** `feat: 重写权限种子为 Casbin 策略表`

---

### Task 5-18: 注入 RBAC 到所有路由 (14 文件，可并行)

每个路由文件做相同模式修改：

1. 添加导入：`import { requirePermission } from '../middleware/rbac'`
2. 在 `createRoute` 的 middleware 数组中加入 `requirePermission('/path', 'action')`
3. 移除 `app.use('*', jwtAuth)` 全局模式，改为逐路由注入

**关键模式示例 (`routes/patients.ts`):**

```typescript
// POST /patients/ — 需要 patient:write
const createPatientRoute = createRoute({
  method: 'post',
  path: '/',
  middleware: [jwtAuth, requirePermission('/patients', 'write')] as const,
  // ...
})

// GET /patients/ — 需要 patient:read
const listPatRoute = createRoute({
  method: 'get',
  path: '/',
  middleware: [jwtAuth, requirePermission('/patients', 'read')] as const,
  // ...
})
```

注意：移除旧的 `patientsApp.use('*', jwtAuth)` — 改为每个 createRoute 的 middleware 数组中显式声明。

提交按路由分组，每 2-4 个路由一个 commit。

---

### Task 19: 修复 plans.ts 积分累加 Bug

**File:** `apps/server/src/routes/plans.ts:138`

```typescript
// 修改前:
.set({ credit: users.credit ?? 0 + plan.rewardCredits } as any)

// 修改后:
.set({ credit: (users.credit ?? 0) + plan.rewardCredits } as any)
```

**Commit:** `fix: 计划完成积分累加运算符优先级`

---

### Task 20: 修复 export.ts 多指标过滤

**File:** `apps/server/src/routes/export.ts:86`

```typescript
// 修改前:
if (input.metrics?.length) conditions.push(eq(events.metric, input.metrics[0]))

// 修改后:
import { inArray } from 'drizzle-orm'
if (input.metrics?.length) conditions.push(inArray(events.metric, input.metrics))
```

**Commit:** `fix: 导出支持多指标过滤`

---

### Task 21: 修复 alertRules.ts 默认阈值

**File:** `apps/server/src/routes/alertRules.ts:8-11`

```typescript
// 修改前:
const DEFAULT_THRESHOLDS: Record<string, ...> = {}

// 修改后: 从 registry 推导
import { listMetrics } from '../core/pipeline/registry'

function buildDefaultThresholds() {
  const metrics = listMetrics()
  return metrics
    .filter(m => m.normalRange)
    .map(m => ({
      metric: m.metric,
      label: m.displayName,
      unit: m.unit,
      min: m.normalRange?.min,
      max: m.normalRange?.max,
      enabled: true,
    }))
}
```

生成默认值并返回给调用方。不再依赖空 `DEFAULT_THRESHOLDS` map。

**Commit:** `fix: 告警规则从 metric registry 推导默认阈值`

---

### Task 22: 扩展 credits.ts (余额/赚取/消费)

**File:** `apps/server/src/routes/credits.ts`

新增 3 个端点：

```typescript
// GET /credits/balance
const balanceRoute = createRoute({
  method: 'get',
  path: '/balance',
  middleware: [jwtAuth, requirePermission('/credits', 'read')] as const,
  responses: { 200: { ... } },
})
creditsApp.openapi(balanceRoute, async (c) => {
  const uid = c.get('userId') as string
  const [user] = await db.select({ credit: users.credit }).from(users).where(eq(users.id, uid)).limit(1)
  return c.json({ balance: user?.credit ?? 0 })
})

// POST /credits/earn
// POST /credits/spend
```

**Commit:** `feat: 扩展积分模块 balance/earn/spend`

---

### Task 23: 扩展 dashboard.ts (趋势+患者概览)

**File:** `apps/server/src/routes/dashboard.ts`

新增 `GET /dashboard/trends` 和 `GET /dashboard/patient/:id`

**Commit:** `feat: dashboard 增加趋势和患者概览`

---

### Task 24: 扩展 users.ts / tags.ts / pins.ts CRUD

**Files:**
- `apps/server/src/routes/users.ts` — `GET /:id`, `DELETE /:id`, `PATCH /:id/role`
- `apps/server/src/routes/tags.ts` — `GET /:id`, `PATCH /:id`
- `apps/server/src/routes/pins.ts` — `GET /:code`, `PATCH /:code`

**Commit:** `feat: 补全 users/tags/pins CRUD`

---

### Task 25: Schema 清理

**Files:**
- `apps/server/src/core/db/schema/enums.ts` — 删除 `deviceTypeEnum`, `deviceStatusEnum`, `adherenceStatusEnum`, `confirmationMethodEnum`, `checklistStatusEnum` 及对应 type exports
- `apps/server/src/core/db/schema.ts` — 删除 `sessions` 表，删除 `sessionId` 的 foreign key reference (line 118)
- `apps/server/src/core/db/schema/auth-ext.ts` — 删除 `permissions` 和 `rolePermissions` 表
- `apps/server/src/modules/twin/schema.ts` — 删除，内容已迁至 `core/db/schema/twin.ts`
- `apps/server/src/core/db/schema/twin.ts` — 新建，包含 `simConfigs` 和 `simPatients`
- `apps/server/src/core/db/index.ts` — 添加 `export * from './schema/twin'` 和 `export * from './schema/plan'`
- `packages/shared-types/src/schemas/index.ts` — 删除 line 9 重复的 `export * from './responses'`

**Commit:** `refactor: 清理孤儿枚举/sessions表/twin schema迁移`

---

### Task 26: Web RBAC 管理页面

**Files:**
- Create: `apps/web/src/pages/RbacManagementPage.tsx`
- Modify: `apps/web/src/routes.tsx`

新增页面 `/settings/rbac`：
- 角色列表 + CRUD
- 权限矩阵（Casbin 策略编辑）
- 用户角色分配

**Commit:** `feat: Web RBAC 管理页面`

---

### Task 27: Web UserManagementPage 增加角色选择

**File:** `apps/web/src/pages/UserManagementPage.tsx`

在用户表格增加角色下拉选择列。

**Commit:** `feat: 用户管理增加角色分配`

---

### Task 28: 数据库迁移 + 验证

- [ ] **Step 1: 生成迁移**

```bash
pnpm db:generate --filter @iomtea/server
```

- [ ] **Step 2: Type check**

```bash
pnpm typecheck --filter @iomtea/server
```

- [ ] **Step 3: Lint**

```bash
pnpm lint --filter @iomtea/server
```

- [ ] **Step 4: Commit migration**

```bash
git add apps/server/drizzle/
git commit -m "chore: 生成 Casbin RBAC + schema 清理迁移"
```

---

## 实现顺序

```
Task 1-2 (依赖 + 核心) → 串行
    ↓
Task 3-4 (中间件 + 种子) → 串行
    ↓
Task 5-18 × Task 19-21 (路由 RBAC × Bug 修复) → 并行
    ↓
Task 22-24 (功能扩展) → 并行
    ↓
Task 25 (Schema 清理) → 串行 (依赖前面所有)
    ↓
Task 26-27 (Web RBAC UI) → 并行
    ↓
Task 28 (迁移 + 验证) → 串行
```
