# IOMTea 平台重构设计文档

> 创建：2026-05-25 | 状态：design

## 一、项目重新定位

| 维度 | 原定位 | 新定位 |
|------|--------|--------|
| **性质** | 居家健康 IoT 监控平台 | 护理研究技术基座平台 |
| **核心** | 23 路由 + 双仿真引擎，功能堆砌 | 通用数据管道 + 模块化课题子系统 |
| **用户** | 临床机构 | 研究者 + 课题参与方 |
| **效率** | 每次课题重写大量代码 | 新课题只需注册指标 ≈ 20% 工作 |
| **演示** | 分散在各页面 | 统一仪表盘 + 3D 孪生可视化 |

## 二、架构总览

```
┌─────────────────────────────────────────────────────────┐
│  Module 层 (Thin 20%)                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ EMA 模块  │ │ Twin 模块│ │ Monitor  │ │Methodol. │   │
│  │表单+应答  │ │仿真+3D   │ │患者+告警 │ │导入+导出 │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       │            │            │            │          │
│  ┌────┴────────────┴────────────┴────────────┴────┐     │
│  │          Platform Core (Thick 80%)              │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │     │
│  │  │ 数据管道  │  │metricReg │  │ 可视化基座│     │     │
│  │  │摄入→存储  │  │指标注册表│  │仪表盘+3D │     │     │
│  │  │→查询→导出│  │          │  │          │     │     │
│  │  └──────────┘  └──────────┘  └──────────┘     │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │     │
│  │  │ 认证授权  │  │ RBAC     │  │ WebSocket│     │     │
│  │  └──────────┘  └──────────┘  └──────────┘     │     │
│  └───────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

**Module 间通信规则**：只通过 `events` 表（数据）或 tRPC 调用（行为）。禁止直接 import 对方内部文件。

## 三、数据管道设计

### 3.1 存储模型

#### sessions 表（新建）
```sql
sessions (
  id          uuid PK DEFAULT gen_random_uuid(),
  patient_id  uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  source      text NOT NULL,  -- 'device' | 'manual' | 'batch' | 'sim'
  type        text,            -- 'daily-mood-ema' / 'sensor-stream' / ...
  status      text DEFAULT 'active',
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  tags        jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
)
```

#### events 表（改造现有）
```sql
events (
  -- 现有字段保持不变
  id            uuid PK DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  pin_code      text,
  kind          text NOT NULL,
  source        text NOT NULL,
  metric        text NOT NULL,
  value         jsonb NOT NULL,            -- ★ 改为 jsonb，标量 72 和对象 {"mood":4} 统一
  unit          text,
  confidence    real DEFAULT 1.0,
  severity      text,
  status        text,
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz DEFAULT now(),
  -- 新增字段
  session_id    uuid REFERENCES sessions(id) ON DELETE SET NULL,
  tags          jsonb DEFAULT '{}'
)
```

#### 设计决策

1. **`value` 改 jsonb**：标量 `72` 和对象 `{"mood":4, "stress":67}` 存同一列。做查询时用 `value::numeric`（标量）或 `value->>'field'`（对象）区分。

2. **`session_id` 可选关联**：EMA 填答关联到采集会话（用于分析响应率/脱落），设备流式数据不填 session_id。

3. **数据类型注册表在代码层**（非 DB 表）：每种指标自带"说明书"，系统据此自动解析。

### 3.2 指标注册表

```typescript
// apps/server/src/core/pipeline/registry.ts

interface MetricField {
  path: string        // 'mood' (JSON path in value jsonb)
  label: string       // '情绪评分'
  type: 'number' | 'text' | 'choice' | 'boolean'
  choices?: string[]
}

interface MetricDefinition {
  metric: string                                    // 'heart_rate'
  displayName: string                               // '心率'
  unit: string                                      // 'bpm'
  valueSchema: z.ZodSchema                          // 摄入校验
  valueType: 'scalar' | 'object'
  fields?: MetricField[]                            // object 类型的子字段定义
  normalRange?: { min: number; max: number }
  alertThresholds?: { low?: number; high?: number }
  defaultChart: 'line' | 'bar' | 'gauge' | 'scatter'
  category: 'vital' | 'ema' | 'behavior' | 'lab' | 'custom'
}

const metricRegistry = new Map<string, MetricDefinition>()

export function registerMetric(def: MetricDefinition): void
export function getMetric(metric: string): MetricDefinition | undefined
export function listMetrics(category?: string): MetricDefinition[]
export function resolveField(metric: string, fieldPath?: string): { definition: MetricDefinition; field?: MetricField }
```

**注册发生在各模块的 `metrics.ts`**，在 server 启动时收集。新课题只需在模块目录调用 `registerMetric(...)`。

### 3.3 摄入管道

四种摄入来源，统一走 `ingestRouter`：

| 来源 | kind | 说明 |
|------|------|------|
| `device` | `observation` | MQTT 设备自动上报（心率、血氧等） |
| `manual` | `observation` / `ema_response` | 前端表单录入（含 EMA 填答，视为手动输入的一种） |
| `batch` | `batch_record` | CSV / Excel / JSON 批量导入（新类型） |
| `sim` | `observation` | 仿真引擎输出 |

```
device ──┐
manual ──┤    ┌─────────────┐    ┌──────────┐
batch  ──┼──→ │ ingestRouter │──→ │  events  │
sim    ──┘    │ .validate()  │    │  table   │
              │ .write()     │    └──────────┘
              └─────────────┘
```

**ingestRouter 过程**：

| 过程 | 说明 |
|------|------|
| `ingest.single` | 单条写入，校验 valueSchema |
| `ingest.batch` | 批量写入（CSV 导入走此路），返回 { success, failed, skipped } |
| `ingest.validate` | 仅校验不入库，供前端预览 |

**批量导入流程**：上传 CSV → 前端预览 + 列映射 → `ingest.validate` → 用户确认 → `ingest.batch`。

### 3.4 查询管道

改造现有 `dataRouter`，实现六种查询：

| 过程 | 说明 | 自适应行为 |
|------|------|-----------|
| `data.raw` | 原始时序点 | scalar→`value::numeric`；object→`value->>'fieldPath'` |
| `data.aggregate` | 按粒度聚合（min/h/d/w） | 同上 + GROUP BY date_trunc |
| `data.latest` | 每指标最新值 | 仪表盘卡片数据源 |
| `data.compare` | 两时段对比 | 返回 `{ before, after, delta }` |
| `data.gap` | 缺失时间段检测 | 数据完整性审计 |
| `data.summary` | 全患者指标汇总 | 研究级统计摘要 |

所有查询通过 `metricRegistry` 自动解析字段路径，新增指标零额外代码。

### 3.5 导出管道

扩展现有 `exportRouter`，支持四种格式：

| 格式 | 输出 | 用途 |
|------|------|------|
| `csv` | 扁平表，object 字段自动展开为独立列 | 通用导出 |
| `long` | Tidy data 长格式（patient×metric×time） | R/ggplot2, Python/seaborn |
| `wide` | 宽格式（patient×timepoint×metric matrix） | SPSS 重复测量方差分析 |
| `session` | 以 Session 为中心一行一条 | EMA 响应率/脱落分析 |

## 四、Module 架构 & 23 项交互 Checklist

### 4.1 模块目录模板

```
apps/server/src/modules/<name>/
  ├── schema.ts       # 专属 DB 表 Drizzle 定义（如有）
  ├── metrics.ts      # registerMetric(...) 调用
  ├── router.ts       # tRPC 子路由
  └── index.ts        # 导出 { router, init?, seed? }

apps/web/src/modules/<name>/
  ├── pages/          # 该模块的独立页面组件
  │   ├── List.tsx
  │   ├── Detail.tsx
  │   ├── Create.tsx
  │   └── Edit.tsx
  ├── components/     # 模块私有组件
  └── index.ts        # 导出路由定义配置
```

### 4.2 前端路由集成

前端使用 **单文件 Code Router**（`apps/web/src/routes.tsx`）。模块通过导出路由配置对象来注册，在 `routes.tsx` 中按需引入：

```typescript
// apps/web/src/routes.tsx
import { emaRoutes } from './modules/ema'

// ... 在 routeTree 中合并
const routeTree = rootRoute.addChildren([
  loginRoute,
  authRoute.addChildren([
    dashboardRoute,
    // ... 现有路由
    ...emaRoutes,  // 模块路由插入
  ]),
])
```

模块的路由配置以数组形式导出，可被主路由文件直接 spread：

```typescript
// apps/web/src/modules/ema/index.ts
export const emaRoutes = [
  createRoute({ getParentRoute: () => authRoute, path: '/ema', component: EmaFormList }),
  createRoute({ getParentRoute: () => authRoute, path: '/ema/$formId', component: EmaFormDetail }),
  // ...
]
```

### 4.3 23 项交互 Checklist

每个模块交付时，以下清单必须全部打勾。

#### 数据层（3 项）
| # | 检查项 | 说明 |
|---|--------|------|
| D1 | Schema 完整 | 模块专属表已定义、已 migrate，零 `as any` |
| D2 | 指标注册 | 向 `metricRegistry` 注册全部指标（含 valueSchema/fields/normalRange/defaultChart） |
| D3 | Seed 数据 | 有演示用种子数据，确保启动后无需手动造数据即可展示完整流程 |

#### API 层（5 项）
| # | 检查项 | 说明 |
|---|--------|------|
| A1 | CRUD 完备 | list / detail / create / update / delete |
| A2 | 输入校验 | 每个 procedure 有 Zod schema 校验 |
| A3 | 权限控制 | `requirePermission('resource:action')` 覆盖写操作，读操作验证登录态 |
| A4 | 错误处理 | 所有 catch 分支 logger.error + throw TRPCError，零 silent catch |
| A5 | 分页/筛选 | list 接口支持 pagination + filter |

#### 用户体验层（10 项）
| # | 检查项 | 说明 |
|---|--------|------|
| U1 | 路由注册 | 页面在 `routes.tsx` 路由树中可访问 |
| U2 | 列表页 | 数据表格 + 分页 + 搜索/筛选 + 排序 |
| U3 | 详情页 | 单条完整信息展示，含关联数据 |
| U4 | 新建表单 | 表单校验 + 提交反馈 + 成功后跳转/刷新 |
| U5 | 编辑表单 | 回填已有数据 + 校验和反馈 |
| U6 | 删除操作 | 确认弹窗 + 删除后列表刷新 |
| U7 | 加载态 | Skeleton / Spinner |
| U8 | 空状态 | 无数据时显示引导（"暂无数据，点此创建"） |
| U9 | 错误态 | 接口异常显示错误信息 + 重试按钮 |
| U10 | 操作反馈 | 创建/编辑/删除 Toast 通知 |

#### 交互闭环层（5 项）
| # | 检查项 | 说明 |
|---|--------|------|
| C1 | 管道贯通 | 模块产出数据可被 `data.query` 查询、`export` 导出 |
| C2 | 实时联动 | 涉及实时数据时，WebSocket 更新反映在页面上 |
| C3 | 仪表盘可见 | 模块关键指标出现在 `/` dashboard 页 |
| C4 | 权限联动 | 无权限时 UI 隐藏操作按钮 |
| C5 | 移动端可用 | 列表/表单在手机宽度下正常显示 |

## 五、现有代码处置方案

### 5.1 保留并增强

| 现有 | 处置 |
|------|------|
| `core/trpc/routers/auth.ts` | 保留 |
| `core/trpc/routers/user.ts` | 保留 |
| `core/trpc/routers/pin.ts` + `virtual-pin.ts` | 保留 |
| `core/trpc/routers/dashboard.ts` | 保留，增加模块指标自动聚合 |
| `core/trpc/routers/data.ts` | **重大改造**：实现 raw/aggregate/latest/compare/gap/summary |
| `core/trpc/routers/export.ts` | **扩展**：long/wide/session/csv 四格式 |
| `core/trpc/routers/alert.ts` + `alertRule.ts` | 保留，纳入 monitor |
| `core/trpc/routers/patient.ts` | 保留，纳入 monitor |
| `core/trpc/routers/medication.ts` | 精简保留 |
| `core/trpc/routers/tag.ts` | 保留 |
| `core/trpc/middleware/auth.ts` + `rbac.ts` | 保留 |
| `core/realtime/broadcast.ts` | 保留 |
| `core/db/schema.ts`（核心4表） | 保留，events.value 改 jsonb，加 session_id |
| `core/db/schema/enums.ts` | 保留 |
| `packages/shared-types/` | 保留下游消费的类型，新增 pipeline types |
| Web 基础组件 | 保留 |
| `apps/flutter/` | 保留，暂不纳入本次重构 |
| 前端路由 `routes.tsx`（code router） | 保留，模块路由通过 spread 插入 |

### 5.2 合并

| 现有 | → | 目标 |
|------|---|------|
| `twin/engine.ts` + `twin/physiology/` 9 文件 | → | `modules/twin/engine.ts`，提取共用 RNG 到 `core/pipeline/physiology.ts` |
| `sim/factory.ts` + `sim/physiology.ts` | → | 同上，per-metric 调度 + DB 持久化融入新 engine |
| `twin/profiles/` 5 文件 + `sim/profiles.ts` | → | `modules/twin/profiles.ts`，单一画像定义源 |
| `twinRouter` + `simulationRouter` + `simRouter` | → | `modules/twin/router.ts`，单一仿真入口 |
| `homeGraph` + `nodeGraph` routers | → | 纳入 twin 模块 |
| `simConfigs` + `simPatients` 表定义 | → | 移至 `modules/twin/schema.ts` |

### 5.3 移除

| 现有 | 原因 |
|------|------|
| `checklist` router + DB 表 | 课题无关 gamification |
| `credit` router + DB 表 | 同上 |
| `streak` router + DB 表 | 同上 |
| `plan` router + DB 表 | 同上 |
| `healthRecords` router | 功能由 data pipeline 覆盖 |
| `apps/miniapp/` | 暂停维护 |
| `core/db/schema/plan.ts` | 随 plan 移除 |
| `core/db/schema/medication.ts` 的 schedules/adherence 子表 | 精简，仅保留 medications 表 |
| Twin 行为机/pathfinding/nav-mesh | 合并后如不再需要则移除 |

### 5.4 新建

| 模块 | 路径 | 内容 |
|------|------|------|
| **核心管道** | `core/pipeline/` | registry.ts, ingest-router.ts, physiology.ts, query-helpers.ts |
| **Twin 模块** | `modules/twin/` | schema.ts, engine.ts, profiles.ts, metrics.ts, router.ts |
| **Monitor 模块** | `modules/monitor/` | 收拢 patient/alert/medication/tag 后端逻辑，加 metrics.ts |
| **EMA 模块** | `modules/ema/` | schema.ts, metrics.ts, router.ts（后端）；pages/ + components/（前端） |
| **Methodology 模块** | `modules/methodology/` | 批量导入页 + 导出工作台（轻量，无新 DB 表） |

## 六、各模块详细规格

### Module 0：Platform Core（管道层）

**范围**：`core/pipeline/` + `core/trpc/routers/data.ts`（改造）+ `core/trpc/routers/export.ts`（扩展）

| # | 检查项 | 实施要点 |
|---|--------|---------|
| D1 | Schema | events.value → jsonb；新建 sessions 表；enum 新增 batch/ema_response 值 |
| D2 | 指标 | 默认注册通用 vital 指标（心率/血氧/体温/血压/血糖/呼吸），各模块追加 |
| D3 | Seed | 保留现有 3 患者 demo 数据，确保管道查询可跑通 |
| A1 | CRUD | data.raw / aggregate / latest / compare / gap / summary |
| A2 | 校验 | 查询参数 zod schema + metricRegistry 存在性检查 |
| A3 | 权限 | requirePermission('data:read') |
| A4 | 错误 | TRPCError + logger.error |
| A5 | 分页 | data.raw 支持 cursor/offset |
| U1-U10 | 体验 | DataDashboard 页根据 metricRegistry.defaultChart 自动选图表 |
| C1 | 管道 | 四格式导出（csv/long/wide/session） |
| C2 | 实时 | WebSocket 推送新 events，前端自动刷新 |
| C3 | 仪表盘 | /dashboard 统计卡来自管道 latest 查询 |
| C4 | 权限 | 无 data:read 隐藏入口 |
| C5 | 移动 | 图表 responsive |

### Module 1：Twin（数字孪生）

**范围**：合并 `twin/` + `sim/` → `modules/twin/`

| # | 检查项 | 实施要点 |
|---|--------|---------|
| D1 | Schema | 迁入 sim_configs/sim_patients，提取共用 physiology 到 core |
| D2 | 指标 | 向 registry 注册 10 种仿真指标（source='sim'） |
| D3 | Seed | 5 画像 + 1 demo 仿真，启动可见 |
| A1 | CRUD | create/delete/toggle/setSpeed/addPatients/removePatients |
| A2 | 校验 | 全量 zod |
| A3 | 权限 | requirePermission('twin:manage') |
| A4 | 错误 | 零 silent catch |
| A5 | 分页 | 仿真列表分页 |
| U1 | 路由 | `/simulation` |
| U2 | 列表 | 仿真卡片 + 运行状态/患者数/指标数 |
| U3 | 详情 | 患者列表 + 实时曲线 |
| U7 | 加载 | 3D 渲染 Skeleton |
| U8 | 空状态 | 引导"创建第一个仿真" |
| U9-U10 | 错误/反馈 | Toast + 重试 |
| C1 | 管道 | 仿真数据写入 events(source=sim) |
| C2 | 实时 | 3D + 曲线 WebSocket 更新 |
| C3 | 仪表盘 | 活跃仿真数 + 告警数 |
| C5 | 移动 | 3D 降级 2D 卡片 |

### Module 2：Monitor（患者监测）

**范围**：收拢 patient + alert + alertRule + medication + tag

| # | 检查项 | 实施要点 |
|---|--------|---------|
| D1-D3 | 数据 | 沿用现有表结构 |
| A1-A5 | API | 保留现有，补齐缺失的 CRUD 方法 |
| U1-U10 | 体验 | 逐一核查现有页面，补齐缺失的 U 项 |
| C1-C5 | 闭环 | 数据可查询导出，告警计数上仪表盘 |

### Module 3：EMA（生态瞬时评估）★ 新建

**范围**：表单定义 + 定时推送 + 应答采集 + 分析

| # | 检查项 | 实施要点 |
|---|--------|---------|
| D1 | Schema | `ema_forms` 表（id, code, title, description, cron, fields jsonb, status） |
| D2 | 指标 | 每个 form 发布时 registerMetric，valueType='object'，fields 来自 form 字段定义 |
| D3 | Seed | 2 示例表单（每日情绪 + 疼痛评估），含 demo 填答数据 |
| A1 | CRUD | 表单：list/detail/create/update/delete；应答：submit/getByPatient/getByForm |
| A2 | 校验 | FormDefinitionSchema + buildResponseSchema |
| A3 | 权限 | 管理 requirePermission('ema:manage')，填答仅需登录 |
| A4 | 错误 | 零 silent catch |
| A5 | 分页 | 表单列表 + 应答列表分页 |
| U1-U6 | 页面 | 表单设计器（代码配置）+ 应答录入 + 分析页 |
| U7-U10 | 体验 | Skeleton/空态/错误重试/Toast |
| C1 | 管道 | 填答 = events(kind=ema_response)，自动纳入查询/导出 |
| C3 | 仪表盘 | 当日完成率/各患者响应率 |
| C5 | 移动 | 填答页极简，主移动端（EMA 核心场景 = 手机随时填） |

### Module 4：Methodology（方法论工具）★ 新建

**范围**：批量导入 + 导出工作台

| # | 检查项 | 实施要点 |
|---|--------|---------|
| D1-D3 | 数据 | 复用 events 表，无专属表 |
| U1-U10 | 体验 | 批量导入页（上传→映射→预览→确认）+ 导出工作台 |
| C1 | 管道 | 核心价值即管道贯通 |

## 七、实施阶段

### Phase 1：管道重构（最优先，依赖最多）

1. events.value 改 jsonb（migration）
2. 新建 sessions 表（migration）
3. 实现 metricRegistry（core/pipeline/registry.ts）
4. 改造 dataRouter（raw/aggregate/latest/compare/gap/summary）
5. 扩展 exportRouter（csv/long/wide/session）
6. 新增 ingestRouter（single/batch/validate）
7. 改造前端 DataDashboard（自动图表适配）
8. 移除 checklist/credit/streak/plan router + DB 表
9. 补全 core 层 23 项 checklist

### Phase 2：Twin 整合 & Monitor 收拢

1. 提取共用 physiology → core/pipeline/physiology.ts
2. 合并 twin/ + sim/ → modules/twin/
3. 统一仿真 engine + 三路由合并
4. 迁入 simConfigs/simPatients 表定义
5. Monitor 收拢（patient/alert/medication/tag 路由重组）
6. 补全 Monitor + Twin 23 项 checklist

### Phase 3：EMA 新建（演示重点）

1. 建 ema_forms 表
2. 表单 CRUD API
3. 应答采集 API（展示待填表单 + 提交）
4. 前端：表单设计器 + 应答录入 + 分析页
5. EMA 注册到 metricRegistry
6. 补全 EMA 23 项 checklist

### Phase 4：清理 & Methodology 工具

1. 移除 miniapp
2. 批量导入工作台
3. 导出工作台（long/wide/session）
4. 全局演示数据完善（贯通所有模块的完整 demo 流）
5. 全量 typecheck/lint 通过

## 附录 A：目标文件结构

### A.1 Backend 目标结构 (`apps/server/src/`)

```
apps/server/src/
├── index.ts                         # bootstrap（精简，移除 check/gamification 启动逻辑）
├── env.ts
├── core/
│   ├── db/
│   │   ├── schema.ts                # users, refresh_tokens, patients, events(改), sessions(新)
│   │   └── schema/
│   │       ├── enums.ts             # 新增 batch, ema_response 枚举值
│   │       ├── pin.ts               # users_pin
│   │       ├── user-patient.ts      # user_patient_links
│   │       ├── medication.ts        # medications（精简，移除 schedules/adherence）
│   │       ├── tag.ts               # patient_tags, patient_tag_links
│   │       ├── auth-ext.ts          # wechat_accounts, permissions, role_permissions
│   │       └── index.ts             # barrel
│   ├── pipeline/                    # ★ 新建：管道核心
│   │   ├── registry.ts              # metricRegistry
│   │   ├── physiology.ts            # 共用生理生成器（从 twin/sim 提取）
│   │   └── query-helpers.ts         # SQL 构建辅助
│   ├── trpc/
│   │   ├── _app.ts                  # 根路由（精简为 core 路由 + 模块路由）
│   │   ├── index.ts
│   │   ├── context.ts
│   │   ├── routers/
│   │   │   ├── auth.ts
│   │   │   ├── user.ts
│   │   │   ├── data.ts              # ★ 改造：raw/aggregate/latest/compare/gap/summary
│   │   │   ├── export.ts            # ★ 扩展：csv/long/wide/session
│   │   │   ├── ingest.ts            # ★ 新建：single/batch/validate
│   │   │   ├── dashboard.ts         # 增加模块指标自动聚合
│   │   │   ├── pin.ts
│   │   │   └── virtual-pin.ts
│   │   └── middleware/
│   │       ├── auth.ts
│   │       └── rbac.ts
│   ├── realtime/
│   │   └── broadcast.ts
│   ├── lib/
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   ├── logger.ts
│   │   └── banner.ts
│   └── services/
│       ├── permission-seed.ts
│       └── demo-seed.ts
├── modules/                         # ★ 新建：模块化课题子系统
│   ├── twin/                        # twin/ + sim/ 合并
│   │   ├── index.ts
│   │   ├── schema.ts                # sim_configs, sim_patients（从 core/db/schema/sim.ts 迁入）
│   │   ├── engine.ts                # 统一仿真引擎
│   │   ├── profiles.ts             # 5 患者画像（单一数据源）
│   │   ├── metrics.ts              # registerMetric 调用
│   │   └── router.ts               # 合并原 twin/simulation/sim 三路由
│   ├── monitor/                    # patient + alert + alertRule + medication + tag 收拢
│   │   ├── index.ts
│   │   ├── metrics.ts
│   │   └── router.ts               # 重组五个路由至一个命名空间
│   ├── ema/                        # ★ 新建
│   │   ├── index.ts
│   │   ├── schema.ts               # ema_forms 表
│   │   ├── metrics.ts              # 按 form 注册指标
│   │   └── router.ts               # 表单 CRUD + 应答采集
│   └── methodology/                # ★ 新建（无专属 DB 表）
│       ├── index.ts
│       └── router.ts               # 仅占位，实际通过 core ingest/export 完成
└── mqtt-ingest/
    ├── index.ts
    ├── listener.ts
    └── router.ts
```

**移除的目录/文件**：
- `core/trpc/routers/checklist.ts`、`credit.ts`、`streak.ts`、`plan.ts`、`health-records.ts`
- `core/db/schema/plan.ts`
- `core/db/schema/sim.ts`（迁入 modules/twin/）
- `core/db/schema/medication.ts` 的 schedules/adherence 子表
- `twin/` 整个目录（合并后移除）
- `sim/` 整个目录（合并后移除）

### A.2 Frontend 目标结构 (`apps/web/src/`)

```
apps/web/src/
├── main.tsx
├── routes.tsx                       # code router（合并模块路由）
├── routes/
│   ├── __root.tsx                   # RootLayout + Providers
│   └── _auth.tsx                    # AuthLayout + 侧边导航 + beforeLoad
├── trpc.ts
├── theme.ts
├── pages/                           # 核心页面（非模块化）
│   ├── LoginPage.tsx
│   ├── LoginPage.module.css
│   └── DashboardPage.tsx            # 仪表盘（含模块指标自动聚合）
├── modules/                         # ★ 新建：模块化前端
│   ├── monitor/                     # 患者监测模块
│   │   ├── index.ts                 # 导出路由配置数组
│   │   └── pages/
│   │       ├── PatientWall.tsx
│   │       ├── PatientDetailShell.tsx
│   │       ├── PatientOverview.tsx
│   │       ├── PatientProfile.tsx
│   │       ├── PatientAlerts.tsx
│   │       ├── PatientAlertRules.tsx
│   │       ├── PatientMedications.tsx
│   │       ├── HealthTimeline.tsx
│   │       ├── AlertBoard.tsx
│   │       ├── GlobalMedications.tsx
│   │       └── MapEditor.tsx
│   ├── twin/                        # 数字孪生模块
│   │   ├── index.ts                 # 导出路由配置数组
│   │   ├── pages/
│   │   │   └── SimulationPage.tsx
│   │   └── components/
│   │       ├── SimTimeline.tsx
│   │       └── twin3d/              # 3D 渲染（从根目录迁入）
│   │           ├── GraphViewer.tsx
│   │           ├── GraphEditorPage.tsx
│   │           └── RoomNodeGraph.tsx
│   ├── ema/                         # ★ 新建
│   │   ├── index.ts                 # 导出路由配置数组
│   │   ├── pages/
│   │   │   ├── EmaFormList.tsx      # 表单管理列表
│   │   │   ├── EmaFormDesigner.tsx  # 表单设计器
│   │   │   ├── EmaResponse.tsx      # 填答录入
│   │   │   └── EmaAnalysis.tsx      # 响应分析
│   │   └── components/
│   └── methodology/                 # ★ 新建
│       ├── index.ts
│       └── pages/
│           ├── BatchImport.tsx      # 批量导入工作台
│           └── ExportWorkbench.tsx  # 导出工作台（long/wide/session）
├── components/
│   └── shared/                      # 共享基础组件
│       ├── StateComponents.tsx
│       ├── QueryGate.tsx
│       ├── StatsBar.tsx
│       ├── DataTable.tsx
│       └── AccentPaper.tsx
├── store/
│   └── auth.ts
├── hooks/
│   └── useRealtime.ts
└── StoreProvider.tsx
```

**移动/移除**：
- `pages/` 中 monitor 相关页面 → `modules/monitor/pages/`
- `twin3d/` → `modules/twin/components/twin3d/`
- `components/sim/SimTimeline.tsx` → `modules/twin/components/SimTimeline.tsx`
- `pages/DeviceListPage.tsx`（已废弃）、`VirtualPinsPage.tsx`、`TrendsPage.tsx`、`NodeGraphPage.tsx`、`PatientImport.tsx` → 移除或合并
- `components/sim/`、`components/patients/`、`components/graph/`、`components/MiiAvatar/` → 评估后迁入对应 module
- `store/patients.ts`、`store/entityState.ts` → 如仍需要则保留，否则移除
- `pages/components/` → 内容迁入对应位置后移除
