# IOMTea 代码地图 & 功能清单

> 跨包全项目导航。维护者快速定位代码入口。
> 最后更新：2026-05-25

---

## 功能清单 (Feature Checklist)

### 核心功能

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| JWT 认证 (注册/登录/刷新令牌) | ✅ | `core/trpc/routers/auth.ts` |
| 用户管理 (列表/当前用户/更新) | ✅ | `core/trpc/routers/user.ts` |
| 患者 CRUD (列表/详情/创建/编辑/删除) | ✅ | `core/trpc/routers/patient.ts` |
| 用户-患者关联 (user_patient_links) | ✅ | `core/db/schema/user-patient.ts` |
| 告警管理 (列表/确认/指派/解决/关闭) | ✅ | `core/trpc/routers/alert.ts` |
| 时序数据查询 (最新/时间序列) | ✅ | `core/trpc/routers/data.ts` |
| 告警阈值配置 (按患者定制) | ✅ | `core/trpc/routers/alertRule.ts` |
| PIN 管理 (分配/撤销/列表) | ✅ | `core/trpc/routers/pin.ts` |
| 虚拟 PIN 管理 | ✅ | `core/trpc/routers/virtual-pin.ts` |
| 用药管理 (CRUD + 依从性记录) | ✅ | `core/trpc/routers/medication.ts` |
| 标签管理 (Tag CRUD) | ✅ | `core/trpc/routers/tag.ts` |
| 健康记录 | ✅ | `core/trpc/routers/health-records.ts` |
| 数据导出 | ✅ | `core/trpc/routers/export.ts` |
| 工作台仪表盘 | ✅ | `core/trpc/routers/dashboard.ts` |
| 积分与连续打卡 (credit/streak) | ✅ | `core/trpc/routers/credit.ts`, `streak.ts` |
| 计划/随访 (Plan) | ✅ | `core/trpc/routers/plan.ts` |
| 任务清单 (Checklist) | ✅ | `core/trpc/routers/checklist.ts` |
| 居家图 (Home Graph CRUD) | ✅ | `core/trpc/routers/home-graph.ts` |
| 节点图 (Node Graph CRUD) | ✅ | `core/trpc/routers/node-graph.ts` |
| 默认阈值 | ✅ | `core/trpc/routers/thresholds.ts` |
| 数字孪生控制 (创建/暂停/调速/场景注入) | ✅ | `twin/trpc/twin.router.ts` |
| 仿真管理 (Simulation/SIM) | ✅ | `twin/trpc/simulation.router.ts`, `sim/router.ts` |
| 仪表盘 | ✅ | `web/src/routes/_auth.index.tsx` |
| 居民管理 (患者列表/详情墙) | ✅ | `web/src/routes/_auth.patients.tsx` |
| 趋势分析 (时序折线图 + 告警标记) | ✅ | `web/src/pages/TrendsPage.tsx` |
| 节点图编辑器 (3D Room Graph) | ✅ | `web/src/twin3d/GraphEditorPage.tsx` |
| 用户管理 | ✅ | `web/src/routes/_auth.settings.users.tsx` |

### WebSocket 实时通信

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| WebSocket 服务端 (/ws, JWT 鉴权) | ✅ | `server/src/index.ts` |
| 广播管理器 (按 Ward/Map/Patient 订阅) | ✅ | `core/realtime/broadcast.ts` |
| 前端 Hook (自动重连) | ✅ | `web/src/hooks/useRealtime.ts` |

### 状态管理 (Zustand)

| Store | 职责 | 文件 |
|------|------|------|
| `useAuthStore` | JWT 令牌持久化 | `web/src/store/auth.ts` |
| `usePatientStore` | 患者列表共享、选中患者 | `web/src/store/patients.ts` |
| `useEntityStateStore` | 实体位置/姿态（WS 写入） | `web/src/store/entityState.ts` |

### 数字孪生引擎

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| 仿真引擎 (创建/暂停/恢复/调速/删除) | ✅ | `twin/engine.ts` |
| 运行调度器 | ✅ | `twin/scheduler.ts` |
| 患者画像: 老年心血管 | ✅ | `twin/profiles/elderly-cardiac.ts` |
| 患者画像: 术后恢复 | ✅ | `twin/profiles/post-surgery.ts` |
| 患者画像: 糖尿病 | ✅ | `twin/profiles/diabetes.ts` |
| 患者画像: COPD 呼吸疾病 | ✅ | `twin/profiles/copd-respiratory.ts` |
| 患者画像: 孕产监护 | ✅ | `twin/profiles/maternity.ts` |
| A* 寻路 | ✅ | `twin/pathfinding.ts` |
| 智能体行为引擎 | ✅ | `twin/behavior.ts` |
| 动作指令系统 | ✅ | `twin/instruction.ts` |
| 仿真控制 tRPC | ✅ | `twin/trpc/twin.router.ts` |
| 仿真管理 tRPC | ✅ | `twin/trpc/simulation.router.ts` |
| SIM 引擎 (新一代) | ✅ | `sim/` (factory, scheduler, physiology, profiles, router, types) |
| Demo 模式 (自动创建+种子账号) | ✅ | `server/src/index.ts` → `bootstrap()` |

### MQTT 设备接入

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| MQTT 客户端连接/订阅 | ✅ | `mqtt-ingest/index.ts` |
| MQTT 消息监听器 | ✅ | `mqtt-ingest/listener.ts` |
| MQTT 数据写入路由 | ✅ | `mqtt-ingest/router.ts` |

### 微信小程序

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| 首页九宫格 | ✅ | `miniapp/src/pages/index/index.tsx` |
| 微信登录 (模拟) | ✅ | `miniapp/src/pages/login/index.tsx` |
| 告警列表 | ✅ | `miniapp/src/pages/alerts/index.tsx` |
| 数据查看器 | ✅ | `miniapp/src/pages/data/index.tsx` |
| 设置页 | ✅ | `miniapp/src/pages/settings/index.tsx` |

### Flutter 实验工具

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| MQTT 控制台 | ✅ | `flutter/lib/pages/mqtt_console_page.dart` |
| YOLO 跌倒检测 | ✅ | `flutter/lib/pages/vision_page.dart` |
| IMU 运动监测 | ✅ | `flutter/lib/pages/imu_page.dart` |
| 设置页 | ✅ | `flutter/lib/pages/settings_page.dart` |

---

## 文件导航 (File Map)

### `apps/server/` — 后端服务

```
src/
├── index.ts                    # Hono 服务器, CORS, tRPC, WebSocket (JWT鉴权), Demo bootstrap
├── env.ts                      # Zod 环境变量验证
│
├── core/
│   ├── db/
│   │   ├── index.ts            # Drizzle ORM 客户端
│   │   ├── schema.ts           # 4 主表: users, refresh_tokens, patients, events
│   │   ├── schema/             # 模块化 schema: enums, pin, user-patient, plan, medication, tag, sim, auth-ext
│   │   └── services/           # room-lookup-cache, thing-room-lookup
│   ├── lib/
│   │   ├── jwt.ts              # JWT 签名/验证 (jose + Argon2, refresh token rotation)
│   │   ├── password.ts         # Argon2 密码哈希
│   │   └── wechat.ts           # 微信工具
│   ├── realtime/
│   │   └── broadcast.ts        # WebSocket 广播管理器 (按订阅, 实体状态 + 体征)
│   └── trpc/
│       ├── context.ts           # tRPC 上下文 (db, req)
│       ├── init.ts              # tRPC 实例 (protectedProcedure, publicProcedure)
│       ├── index.ts             # 导出
│       ├── middleware/
│       │   ├── auth.ts          # Bearer Token 中间件
│       │   └── rbac.ts          # RBAC 权限中间件 (requirePermission)
│       └── routers/
│           ├── _app.ts          # 根路由器 (23 个子路由器)
│           ├── auth.ts          # register, login, refresh, wechatLogin (publicProcedure)
│           ├── user.ts          # list, me, update (内联 role 检查)
│           ├── patient.ts       # list, byId, create, update, delete (requirePermission)
│           ├── pin.ts           # PIN 管理 (protectedProcedure)
│           ├── virtual-pin.ts   # 虚拟 PIN 管理
│           ├── alert.ts         # list, acknowledge, assign, resolve, close (requirePermission)
│           ├── data.ts          # timeseries, latest (requirePermission)
│           ├── alertRule.ts     # byPatient, upsert (requirePermission)
│           ├── medication.ts    # 用药 CRUD + adherence (requirePermission)
│           ├── checklist.ts     # 任务清单 CRUD
│           ├── credit.ts        # 积分管理
│           ├── streak.ts        # 连续打卡
│           ├── plan.ts          # 计划/随访
│           ├── tag.ts           # 标签管理
│           ├── health-records.ts # 健康记录
│           ├── dashboard.ts     # 工作台仪表盘 (requirePermission)
│           ├── export.ts        # 数据导出 (requirePermission)
│           ├── home-graph.ts    # 居家图 CRUD (requirePermission)
│           ├── node-graph.ts    # 节点图 CRUD (requirePermission)
│           └── thresholds.ts    # 默认阈值
│
├── sim/                        # 新一代仿真引擎
│   ├── factory.ts              # 仿真工厂
│   ├── scheduler.ts            # 调度器
│   ├── physiology.ts           # 生理模型
│   ├── profiles.ts             # 患者画像
│   ├── router.ts               # tRPC 路由
│   └── types.ts                # 类型定义
│
├── twin/                       # 数字孪生引擎 (第一代)
│   ├── engine.ts               # 仿真引擎
│   ├── scheduler.ts            # 运行调度
│   ├── types.ts                # 类型定义
│   ├── pathfinding.ts          # A* 寻路
│   ├── behavior.ts             # 智能体行为
│   ├── nav-mesh.ts             # 导航网格
│   ├── instruction.ts          # 动作指令
│   ├── db-writer.ts            # 事件 DB 写入
│   ├── profiles/               # 5 种患者画像
│   ├── physiology/             # 12 种生理生成器
│   └── trpc/
│       ├── twin.router.ts      # 仿真控制 tRPC
│       └── simulation.router.ts # 仿真管理 tRPC
│
├── mqtt-ingest/                # MQTT 设备数据接入
│   ├── index.ts
│   ├── listener.ts
│   └── router.ts
```

### `apps/web/` — Web 仪表盘

```
src/
├── main.tsx                     # React 入口
├── StoreProvider.tsx            # Zustand Store 统一初始化
├── trpc.ts                      # tRPC 客户端 + Token 刷新 (race dedup)
├── theme.ts                     # Mantine v8 主题
│
├── store/
│   ├── auth.ts                  # useAuthStore (JWT 令牌)
│   ├── patients.ts              # usePatientStore (患者列表 + 选中患者)
│   └── entityState.ts           # useEntityStateStore (实体位置/姿态)
│
├── hooks/
│   └── useRealtime.ts           # WebSocket Hook (JWT token 传递, 自动重连)
│
├── routes/                      # TanStack Router file-based routing
│   ├── __root.tsx               # 根布局
│   ├── _auth.tsx                # 认证门控布局
│   ├── _auth.index.tsx          # 工作台仪表盘
│   ├── _auth.patients.tsx       # 居民管理 (列表)
│   ├── _auth.patients.$id.tsx   # 患者详情布局
│   ├── _auth.patients.$id.index.tsx      # 患者概览
│   ├── _auth.patients.$id.alerts.tsx      # 患者告警
│   ├── _auth.patients.$id.medications.tsx # 患者用药
│   ├── _auth.patients.$id.alert-rules.tsx # 告警阈值
│   ├── _auth.patients.$id.health-timeline.tsx # 健康时间线
│   ├── _auth.patients.$id.profile.tsx     # 患者档案
│   ├── _auth.patients.$id.map-editor.tsx  # 地图编辑器
│   ├── _auth.alerts.tsx         # 异常处置中心
│   ├── _auth.medications.tsx    # 全局用药
│   ├── _auth.data-dashboard.tsx # 数据仪表盘
│   ├── _auth.data-export.tsx    # 数据导出
│   ├── _auth.iot.pins.tsx       # PIN 管理
│   ├── _auth.simulation.tsx     # 仿真管理
│   ├── _auth.settings.tsx       # 设置页
│   ├── _auth.settings.users.tsx # 用户管理
│   └── login.tsx                # 登录/注册
│
├── pages/
│   ├── PatientWall.tsx          # 患者卡片墙 (legacy)
│   ├── TrendsPage.tsx           # 健康趋势分析
│   ├── NodeGraphPage.tsx        # 节点图页面
│   ├── VirtualPinsPage.tsx      # 虚拟PIN页面
│   ├── PatientImport.tsx        # 患者导入
│   └── ...                      # 更多 legacy页面
│
├── components/
│   ├── shared/
│   │   ├── StateComponents.tsx  # 统一 Skeleton/Error/Empty 状态组件
│   │   ├── QueryGate.tsx        # 查询门控包装器
│   │   ├── StatsBar.tsx         # 统计栏
│   │   ├── DataTable.tsx        # 通用数据表
│   │   └── AccentPaper.tsx      # 强调面板
│   ├── patients/PatientCard.tsx # 患者卡片
│   ├── sim/
│   │   ├── EventTimeline.tsx    # 事件时间线 (card lanes, metric toggle, zoom)
│   │   └── SimTimeline.tsx      # 仿真时间线
│   ├── graph/
│   │   ├── RoomNode.tsx         # 房间节点渲染
│   │   └── NodePanel.tsx        # 节点面板
│   └── MiiAvatar/               # Mii 头像编辑器
│
└── twin3d/                      # 3D 孪生可视化
    ├── index.ts
    ├── GraphViewer.tsx          # 图可视化器
    ├── GraphEditorPage.tsx      # 图编辑器页面
    └── RoomNodeGraph.tsx        # 房间节点图
```

### `packages/shared-types/` — 共享类型

```
src/
├── index.ts                     # 公共导出
├── constants.ts                 # 枚举常量
├── avatar-spec.ts               # 头像规格
├── mii-params.ts                # Mii 参数
├── ema/                         # EMA 通证管理
└── schemas/
    ├── auth.ts                  # Zod: register/login/tokenPair
    ├── user.ts                  # Zod: user
    ├── patient.ts               # Zod: patient
    ├── device.ts                # Zod: device (devices 表已删除, schema 保留用于 PIN 模式)
    ├── events.ts                # Zod: observation/alert/eventList/eventTimeSeries
    ├── medication.ts            # Zod: medication
    └── twin.ts                  # Zod: twin/simulation
```

### `apps/miniapp/` — 微信小程序

```
src/
├── app.tsx
├── app.config.ts
├── utils/
│   └── trpc.ts                  # tRPC 客户端 (Taro.request 适配)
└── pages/
    ├── index/index.tsx           # 首页九宫格
    ├── login/index.tsx           # 登录
    ├── alerts/index.tsx          # 告警列表
    ├── data/index.tsx            # 数据查看
    └── settings/index.tsx        # 设置
```

### `apps/flutter/` — Flutter 实验工具

```
lib/
├── main.dart
├── app.dart
├── pages/
│   ├── home_page.dart
│   ├── mqtt_console_page.dart
│   ├── vision_page.dart
│   ├── imu_page.dart
│   └── settings_page.dart
├── services/
│   ├── mqtt_service.dart
│   ├── imu_sensor_service.dart
│   └── mqtt_models.dart
└── widgets/
    └── imu_waveform.dart
```

### 基础设施

```
├── docker-compose.yml
├── turbo.json
├── biome.json
├── tsconfig.base.json
├── .env.example
├── .github/workflows/           # CI/CD (tag-based deploy triggers)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CODE_MAP.md              # 本文档
│   └── superpowers/
│       ├── specs/               # 设计规范
│       └── plans/               # 实施计划
```

---

## 快速查找指南

### 我想修改...

| 目标 | 去哪 |
|------|------|
| 添加新的生理指标 | `twin/physiology/` 或 `sim/physiology.ts` → 扩展类型 → 在 engine 中调用 |
| 添加新的患者画像 | `twin/profiles/` 或 `sim/profiles.ts` → 注册 |
| 添加新的 API 端点 | `core/trpc/routers/` 新增 → `_app.ts` 注册 → `shared-types/schemas/` schema |
| 修改数据库主表 | `core/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate` |
| 修改数据库子模块 | `core/db/schema/` → 按需 migration |
| 修改仪表盘 UI | `web/src/routes/_auth.index.tsx` |
| 修改节点图/孪生可视化 | `web/src/twin3d/` |
| 修改数字孪生行为 | `twin/behavior.ts` + `twin/pathfinding.ts` |
| 修改 WebSocket 消息 | `core/realtime/broadcast.ts` (服务端) + `web/src/hooks/useRealtime.ts` (客户端) |
| 修改 Zustand Store | `web/src/store/` |
| 修改 CI/CD | `.github/workflows/` |
| 修改 MQTT 接入 | `mqtt-ingest/` |
| 修改 Docker 部署 | `docker-compose.yml` |
| 修改环境变量 | `apps/server/src/env.ts` → `.env.example` |
| 修改认证逻辑 | `core/trpc/middleware/auth.ts` + `core/lib/jwt.ts` + `core/lib/password.ts` |
| 修改 RBAC | `core/trpc/middleware/rbac.ts` + `core/services/permission-seed.ts` |
| 修改 PIN 管理 | `core/trpc/routers/pin.ts` + `core/db/schema/pin.ts` |

### 关键类型定义

| 类型 | 位置 |
|------|------|
| `AppRouter` (tRPC 全类型) | `server/src/core/trpc/routers/_app.ts` |
| `JwtPayload` | `server/src/core/lib/jwt.ts` |
| DB Schema | `server/src/core/db/schema.ts` + `server/src/core/db/schema/` |
| Zod Schemas | `packages/shared-types/src/schemas/` |

### 常用开发流程

**添加新患者画像:**
1. `twin/profiles/<new>.ts` 或 `sim/profiles.ts` — Profile 常量
2. 注册到对应的 index.ts
3. `server/src/index.ts` — Demo bootstrap 添加

**添加新生理指标:**
1. `twin/physiology/<new>.ts` 或 `sim/physiology.ts` — 生成器
2. 扩展 types.ts 中的 baseline
3. engine tick 调用

**扩展 tRPC API:**
1. `shared-types/src/schemas/` — Zod schema
2. `core/trpc/routers/<name>.ts` — procedure + `requirePermission`
3. `core/trpc/routers/_app.ts` — 注册

**添加新 Zustand Store:**
1. `web/src/store/<name>.ts` — `create()` 定义
2. `web/src/StoreProvider.tsx` — 初始化逻辑（如需要）
