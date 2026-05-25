# 后端 RBAC + 功能补全 + 清理 — 设计文档

**日期**: 2026-05-25
**分支**: `feat/backend-rbac-cleanup`

---

## 1. 目标

后端正交补全：Casbin RBAC 替代自研鉴权、3 个功能性 Bug 修复、积分模块扩至读写、缺失 CRUD 补全、数据库 schema 清理。

## 2. RBAC — Casbin 替代自研

### 2.1 依赖

```
casbin          — 核心引擎
@casbin/pg-adapter — PostgreSQL 策略存储
```

### 2.2 架构

```
请求 → jwtAuth → requirePermission(obj, act) → Casbin Enforcer → 放行/403
```

- obj: 路由路径，如 `/patients/:id`
- act: HTTP 方法或动作名，如 `read` | `write` | `delete`

### 2.3 model.conf

```ini
[request_definition] r = sub, obj, act
[policy_definition] p = sub, obj, act
[role_definition] g = _, _
[policy_effect] e = some(where (p.eft == allow))
[matchers] m = g(r.sub, p.sub) && keyMatch(r.obj, p.obj) && keyMatch(r.act, p.act)
```

Casbin `keyMatch` 支持 `*` 通配和 `:id` 参数匹配。

### 2.4 默认策略

```
p, role:super_admin, *, *
p, role:admin, *, *
p, role:user, /patients/*, read
p, role:user, /dashboard/*, read
p, role:user, /alerts/*, read
p, role:user, /data/*, read
p, role:user, /plans/*, read
p, role:user, /credits/*, read
g, role:admin, role:user
```

### 2.5 中间件接口

```typescript
// middleware/rbac.ts — 重写
export function requirePermission(obj: string, act: string) {
  // 从 c.get('userRole') 取 role，构造 r = role:xxx, obj, act
  // 调用 enforcer.enforce(r.sub, r.obj, r.act)
  // super_admin 快速路径跳过 enforce
}
```

### 2.6 路由 RBAC 注入

每个受保护路由在 `jwtAuth` 后加 `requirePermission(...)`。示例：

```typescript
const listPatientsRoute = createRoute({
  method: 'get', path: '/',
  middleware: [jwtAuth, requirePermission('/patients', 'read')],
  ...
})
```

### 2.7 策略 Seed

`permission-seed.ts` 重写：检查 Casbin 策略表是否为空，空则写入默认策略 + 角色继承。使用 `enforcer.addPolicy()` / `enforcer.addGroupingPolicy()`。

### 2.8 表清理

删除 `permissions` 和 `rolePermissions` 表定义（`auth-ext.ts`），迁移时 DROP。Casbin adapter 自行管理 `casbin_rule` 表。

### 2.9 Web 管理界面

新增页面 `/settings/rbac`：
- 角色列表：CRUD，显示继承链
- 权限矩阵：角色 × (资源 + 动作) 的 Checkbox 网格
- 用户角色分配：UserManagementPage 增加角色下拉选择框

---

## 3. Bug 修复

| # | 文件 | 行 | 问题 | 修复 |
|---|------|-----|------|------|
| 1 | `routes/plans.ts` | 138 | 运算符优先级导致积分不累加 | `(users.credit ?? 0) + plan.rewardCredits` |
| 2 | `routes/export.ts` | 86 | 导出仅取 `input.metrics[0]` | `eq` → `inArray(events.metric, input.metrics)` |
| 3 | `routes/alertRules.ts` | 8-11 | `DEFAULT_THRESHOLDS = {}` 永远为空 | 从 `pipeline/registry.ts` 各 metric 的 range 推导默认阈值 |

---

## 4. 积分模块扩展

新增端点：

| 方法 | 路径 | 权限 | 功能 |
|------|------|------|------|
| GET | `/credits/balance` | `credit:read` | 当前用户积分余额 |
| POST | `/credits/earn` | `credit:write` | 手动奖励积分 |
| POST | `/credits/spend` | `credit:write` | 积分扣减/兑换 |

保留现有 `GET /credits/transactions`。

---

## 5. 缺失 CRUD 补全

### 5.1 Dashboard

| 方法 | 路径 | 权限 | 功能 |
|------|------|------|------|
| GET | `/dashboard/trends` | `dashboard:view` | 近 7 天告警趋势（按天计数） |
| GET | `/dashboard/patient/:id` | `dashboard:view` | 单患者概览（指标摘要 + 近期事件） |

### 5.2 Users

| 方法 | 路径 | 权限 | 功能 |
|------|------|------|------|
| GET | `/users/:id` | `admin:settings` | 单用户详情 |
| DELETE | `/users/:id` | `admin:settings` | 删除用户（软删除或级联清理） |
| PATCH | `/users/:id/role` | `admin:settings` | 更新用户角色 |

### 5.3 Tags

| 方法 | 路径 | 权限 | 功能 |
|------|------|------|------|
| GET | `/tags/:id` | `patient:read` | 单标签详情 |
| PATCH | `/tags/:id` | `patient:write` | 重命名/改颜色 |

### 5.4 Pins

| 方法 | 路径 | 权限 | 功能 |
|------|------|------|------|
| GET | `/pins/:code` | `device:read` | 单 PIN 详情 |
| PATCH | `/pins/:code` | `device:manage` | 更新标签/类型 |

---

## 6. Schema 清理

### 6.1 删除孤儿枚举

`enums.ts` 移除：
- `deviceTypeEnum` / `deviceStatusEnum`（devices 表已删除，2026-05-24）
- `adherenceStatusEnum` / `confirmationMethodEnum`（adherence_records 表不存在）
- `checklistStatusEnum`（checklists 表不存在）

### 6.2 删除 sessions 表

`schema.ts` 移除 `sessions` 表定义（从无应用层查询）。

### 6.3 Twin Schema 归位

`modules/twin/schema.ts` 的 `simConfigs` / `simPatients` 迁移到 `core/db/schema/twin.ts`。

### 6.4 导出整理

- `db/index.ts` 补充 `plan` schema 导出
- `schemas/index.ts` 移除重复的 `export * from './responses'`

---

## 7. 文件变更清单

| 操作 | 文件 |
|------|------|
| **重写** | `middleware/rbac.ts` |
| **重写** | `core/services/permission-seed.ts` |
| **新增** | `core/casbin/model.conf` |
| **新增** | `core/casbin/enforcer.ts` (单例初始化) |
| **新增** | `core/db/schema/twin.ts` |
| **修改** | `routes/*.ts` (14 文件 — 注入 requirePermission) |
| **修改** | `routes/plans.ts` (运算符修复) |
| **修改** | `routes/export.ts` (多指标修复) |
| **修改** | `routes/alertRules.ts` (默认阈值) |
| **修改** | `routes/credits.ts` (扩 balance/earn/spend) |
| **修改** | `routes/dashboard.ts` (扩 trends/patient) |
| **修改** | `routes/users.ts` (扩单查/删除/角色) |
| **修改** | `routes/tags.ts` (扩单查/更新) |
| **修改** | `routes/pins.ts` (扩单查/更新) |
| **修改** | `core/db/index.ts` (补 plan 导出) |
| **修改** | `core/db/schema/enums.ts` (删孤儿枚举) |
| **修改** | `core/db/schema.ts` (删 sessions) |
| **修改** | `core/db/schema/auth-ext.ts` (删 permissions/rolePermissions) |
| **删除** | `modules/twin/schema.ts` (已迁移) |
| **修改** | `packages/shared-types/src/schemas/index.ts` (删重复导出) |
| **新增** | `apps/web/src/pages/RbacManagementPage.tsx` |
| **修改** | `apps/web/src/routes.tsx` (注册 /settings/rbac) |
| **修改** | `apps/web/src/pages/UserManagementPage.tsx` (角色选择) |

---

## 8. 不涉及

- Web 前端 P0 功能修复（概览空白、编辑失效、开关不响应）→ 后续分支处理
- 小程序 trpc 缺失 → 后续分支处理
- MQTT/Twin 引擎静默吞错修复 → 后续分支处理
- 62 处 `as any` 清理 → 逐文件渐进式清理

---

## 9. 验证标准

1. `pnpm typecheck` 通过
2. `pnpm lint` 通过
3. Role: `user` 无法访问 `/patients` POST/PATCH/DELETE → 返回 403
4. Role: `admin` 可访问所有端点
5. 计划完成积分正确累加
6. 导出支持多指标过滤
7. 告警规则返回有效默认阈值
8. 新增端点全部可调用并返回正确数据
9. `drizzle-kit generate` 生成迁移无报错
