# IOMTea 代码地图 & 功能清单

> 跨包全项目导航。维护者快速定位代码入口。

---

## 功能清单 (Feature Checklist)

### 核心功能

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| JWT 认证 (注册/登录/刷新令牌) | ✅ | `core/trpc/routers/auth.ts` |
| 用户管理 (列表/当前用户/更新) | ✅ | `core/trpc/routers/user.ts` |
| 患者 CRUD (列表/详情/创建/编辑/删除) | ✅ | `core/trpc/routers/patient.ts` |
| 设备 CRUD (列表/详情/创建/编辑/删除) | ✅ | `core/trpc/routers/device.ts` |
| 告警管理 (列表/确认/解决) | ✅ | `core/trpc/routers/alert.ts` |
| 时序数据查询 (最新/时间序列) | ✅ | `core/trpc/routers/data.ts` |
| 告警阈值配置 (按患者定制) | ✅ | `core/trpc/routers/alertRule.ts` |
| 居家地图 CRUD (保存/加载) | ✅ | `core/trpc/routers/home-map.ts` |
| PIN 管理 (分配/撤销/列表) | ✅ | `core/trpc/routers/pin.ts` |
| 用药管理 (CRUD) | ✅ | `core/trpc/routers/medication.ts` |
| 预约管理 (CRUD) | ✅ | `core/trpc/routers/appointment.ts` |
| 数字孪生控制 (创建/暂停/调速/场景注入) | ✅ | `twin/trpc/twin.router.ts` |
| 仪表盘 (工作台/患者卡片) | ✅ | `web/src/pages/DashboardPage.tsx` |
| 居民管理 (患者列表/详情墙) | ✅ | `web/src/pages/PatientWall.tsx` |
| 趋势分析 (时序折线图 + 告警标记) | ✅ | `web/src/pages/TrendsPage.tsx` |
| 居家地图查看 (2D SVG 渲染) | ✅ | `web/src/pages/HomeMapViewerPage.tsx` |
| 居家地图编辑器 | ✅ | `web/src/twin/Editor/MapEditorPage.tsx` |

### WebSocket 实时通信

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| WebSocket 服务端 (/ws) | ✅ | `server/src/index.ts` |
| 广播管理器 (按 Ward 订阅) | ✅ | `core/realtime/broadcast.ts` |
| 前端 Hook (自动重连) | ✅ | `web/src/hooks/useRealtime.ts` |
| 实体状态同步 (位置+姿态) | ✅ | broadcast 包含 entityStates |
| 虚拟时间同步 (时区+时刻) | ✅ | broadcast 包含 simulatedTime/timezone |

### 状态管理 (Zustand)

| Store | 职责 | 文件 |
|------|------|------|
| `useAuthStore` | JWT 令牌持久化 | `web/src/store/auth.ts` |
| `usePatientStore` | 患者列表共享、选中患者 | `web/src/store/patients.ts` |
| `useEntityStateStore` | 实体位置/姿态（WS 写入） | `web/src/store/entityState.ts` |
| `StoreProvider` | 单例初始化 | `web/src/StoreProvider.tsx` |

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
| 画像注册表 + 查询 | ✅ | `twin/profiles/index.ts` |
| 心率生成器 (高斯噪声 + 昼夜 + 活动) | ✅ | `twin/physiology/vitals.ts` |
| 呼吸率生成器 | ✅ | `twin/physiology/vitals.ts` |
| 体温生成器 (昼夜节律) | ✅ | `twin/physiology/vitals.ts` |
| 血氧生成器 | ✅ | `twin/physiology/vitals.ts` |
| 离床状态生成器 | ✅ | `twin/physiology/vitals.ts` |
| 血压生成器 (收缩/舒张) | ✅ | `twin/physiology/blood-pressure.ts` |
| 血糖生成器 (餐后曲线模型) | ✅ | `twin/physiology/glucose.ts` |
| 体动指数生成器 | ✅ | `twin/physiology/motion.ts` |
| 姿势状态机 (躺/坐/站/走) | ✅ | `twin/physiology/posture.ts` |
| ECG 心电波形合成器 | ✅ | `twin/physiology/ecg-waveform.ts` |
| 呼吸波形生成器 | ✅ | `twin/physiology/respiratory-waveform.ts` |
| 体压分布生成器 (4x4 网格) | ✅ | `twin/physiology/pressure-distribution.ts` |
| 场景注入 (9 种) | ✅ | `twin/engine.ts` → `injectScenario` |
| A* 寻路 | ✅ | `twin/pathfinding.ts` |
| 智能体行为引擎 | ✅ | `twin/behavior.ts` |
| 导航网格 | ✅ | `twin/nav-mesh.ts` |
| 动作指令系统 | ✅ | `twin/instruction.ts` |
| 仿真控制 tRPC | ✅ | `twin/trpc/twin.router.ts` |
| 事件 DB 写入 | ✅ | `twin/db-writer.ts` |
| Demo 模式 (自动创建+种子账号) | ✅ | `server/src/index.ts` → `bootstrap()` |

### MQTT 设备接入

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| MQTT 客户端连接/订阅 | ✅ | `mqtt-ingest/index.ts` |
| MQTT 消息监听器 | ✅ | `mqtt-ingest/listener.ts` |
| MQTT 数据写入路由 | ✅ | `mqtt-ingest/router.ts` |

### 居家地图系统 (Home Map)

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| 数据类型 (Thing/Room/Grid) | ✅ | `shared-types/src/home-map/types.ts` |
| 栅格构建与碰撞 | ✅ | `shared-types/src/home-map/grid.ts` |
| 房间检测 (flood-fill) | ✅ | `shared-types/src/home-map/room-detection.ts` |
| 运行时状态管理 | ✅ | `shared-types/src/home-map/runtime.ts` |
| 模板工厂 (1室/2室) | ✅ | `shared-types/src/home-map/template-factory.ts` |
| Thing 注册表 | ✅ | `shared-types/src/home-map/things/registry.ts` |
| 放置校验 | ✅ | `shared-types/src/home-map/things/placement.ts` |
| 前端 2D Canvas 渲染 | ✅ | `web/src/twin/HomeMapCanvas.tsx` |
| Thing 精灵渲染 | ✅ | `web/src/twin/ThingRenderer.tsx` |
| 房间叠加色 | ✅ | `web/src/twin/RoomOverlay.tsx` |
| 地图编辑器 | ✅ | `web/src/twin/Editor/MapEditorPage.tsx` |
| 编辑器工具栏 | ✅ | `web/src/twin/Editor/Toolbar.tsx` |
| 编辑器调色板 | ✅ | `web/src/twin/Editor/EditorPalette.tsx` |
| 实体放置工具 | ✅ | `web/src/twin/Editor/ThingPlacer.tsx` |
| 画笔工具 (房间绘制) | ✅ | `web/src/twin/Editor/PaintTool.tsx` |

### 微信小程序

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| 首页九宫格 | ✅ | `miniapp/src/pages/index/index.tsx` |
| 微信登录 (模拟) | ✅ | `miniapp/src/pages/login/index.tsx` |
| 告警列表 | ✅ | `miniapp/src/pages/alerts/index.tsx` |
| 设备列表 | ✅ | `miniapp/src/pages/devices/index.tsx` |
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
├── index.ts                    # Hono 服务器, CORS, tRPC, WebSocket, Demo bootstrap
├── env.ts                      # Zod 环境变量验证
│
├── core/
│   ├── db/
│   │   ├── index.ts            # Drizzle ORM 客户端
│   │   ├── schema.ts           # 6 表: users, refresh_tokens, patients, devices, events, patient_snapshots
│   │   ├── schema/             # 模块化 schema: enums, pin, home-map, twin, auth-ext, appointment, medication
│   │   └── services/           # room-lookup-cache, thing-room-lookup
│   ├── lib/
│   │   ├── jwt.ts              # JWT 签名/验证
│   │   ├── password.ts         # Argon2 密码哈希
│   │   └── wechat.ts           # 微信工具
│   ├── realtime/
│   │   └── broadcast.ts        # WebSocket 广播管理器 (按订阅, 实体状态 + 体征)
│   ├── services/
│   │   ├── medication.ts       # 用药业务逻辑
│   │   ├── appointment.ts      # 预约业务逻辑
│   │   ├── permission-seed.ts  # 权限种子
│   │   ├── room-lookup-cache.ts
│   │   └── thing-room-lookup.ts
│   └── trpc/
│       ├── context.ts           # tRPC 上下文 (db, req)
│       ├── init.ts              # tRPC 实例
│       ├── index.ts             # 导出
│       ├── middleware/
│       │   ├── auth.ts          # Bearer Token 中间件
│       │   └── rbac.ts          # RBAC 权限中间件
│       └── routers/
│           ├── _app.ts          # 根路由器 (12 个子路由器)
│           ├── auth.ts          # register, login, refresh
│           ├── user.ts          # list, me, update
│           ├── patient.ts       # list, byId, create, update, delete
│           ├── pin.ts           # 设备 PIN 管理
│           ├── device.ts        # list, byId, create, update, delete
│           ├── alert.ts         # list, acknowledge, resolve
│           ├── data.ts          # timeseries, latest, ingest
│           ├── alertRule.ts     # byPatient, upsert (自定义阈值)
│           ├── medication.ts    # 用药 CRUD
│           ├── appointment.ts   # 预约 CRUD
│           ├── home-map.ts      # 居家地图 CRUD
│           └── thresholds.ts    # 默认阈值 (5 种患者画像)
│
├── twin/                       # 数字孪生引擎
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
│       └── twin.router.ts      # 仿真控制 tRPC
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
├── App.tsx                      # 主应用: 登录门控, 侧边导航, 路由
├── LoginPage.tsx                # 登录/注册
├── trpc.ts                      # tRPC 客户端 + Token 刷新
├── StoreProvider.tsx            # Zustand Store 统一初始化
│
├── store/
│   ├── auth.ts                  # useAuthStore (JWT 令牌)
│   ├── patients.ts              # usePatientStore (患者列表 + 选中患者)
│   └── entityState.ts           # useEntityStateStore (实体位置/姿态)
│
├── hooks/
│   ├── useRealtime.ts           # WebSocket Hook (自动重连, 写入 Store, 更新 React Query)
│   └── useHomeMap.ts            # 居家地图数据 Hook
│
├── pages/
│   ├── DashboardPage.tsx        # 工作台仪表盘
│   ├── PatientWall.tsx          # 居民管理 (患者卡片墙)
│   ├── PatientDetailShell.tsx   # 患者详情布局壳
│   ├── PatientOverview.tsx      # 患者概览
│   ├── PatientAlerts.tsx        # 患者告警
│   ├── PatientMedications.tsx   # 患者用药
│   ├── PatientAppointments.tsx  # 患者预约
│   ├── PatientProfile.tsx       # 患者档案
│   ├── DeviceListPage.tsx       # 设备管理
│   ├── AlertBoard.tsx           # 异常处置中心
│   ├── GlobalMedications.tsx    # 全局用药
│   ├── GlobalAppointments.tsx   # 全局预约
│   ├── HomeMapViewerPage.tsx    # 居家地图查看器
│   ├── PinManagementPage.tsx    # 设备 PIN 管理
│   └── TrendsPage.tsx           # 健康趋势分析
│
└── twin/                        # 数字孪生前端
    ├── index.ts                 # 公共导出
    ├── HomeMapCanvas.tsx        # 2D Canvas 地图渲染
    ├── ThingRenderer.tsx        # Thing 精灵渲染
    ├── RoomOverlay.tsx          # 房间叠加色
    └── Editor/                  # 地图编辑器
        ├── MapEditorPage.tsx    # 编辑器页面
        ├── Toolbar.tsx          # 工具栏
        ├── EditorPalette.tsx    # 实体调色板
        ├── ThingPlacer.tsx      # 实体放置工具
        ├── PaintTool.tsx        # 房间画笔
        ├── EditorTypes.ts       # 编辑器类型
        └── index.ts             # 桶导出
```

### `packages/shared-types/` — 共享类型

```
src/
├── index.ts                     # 公共导出
├── constants.ts                 # 枚举常量
├── schemas/
│   ├── auth.ts                  # Zod: register/login/tokenPair
│   ├── user.ts                  # Zod: user
│   ├── patient.ts               # Zod: patient
│   ├── device.ts                # Zod: device
│   └── events.ts                # Zod: observation/alert/eventList/eventTimeSeries
└── home-map/
    ├── types.ts                 # Tile, Thing, DetectedRoom, HomeMap, SpriteDef
    ├── grid.ts                  # 栅格构建 (创建/修改 tile)
    ├── room-detection.ts        # flood-fill 房间检测
    ├── runtime.ts               # 运行时实体状态
    ├── template-factory.ts      # 默认地图工厂
    ├── things/
    │   ├── index.ts             # 桶导出
    │   ├── registry.ts          # Thing 定义注册表
    │   └── placement.ts         # 放置校验
    ├── templates/
    │   ├── index.ts             # 模板索引
    │   ├── one-bedroom.ts       # 一室户模板
    │   └── two-bedroom.ts       # 二室户模板
    ├── index.ts                 # 桶导出
    └── __tests__/               # 单元测试 (grid, room-detection, placement, runtime, templates)
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
    ├── devices/index.tsx         # 设备列表
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
├── .github/workflows/           # CI/CD
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
| 添加新的生理指标 | `twin/physiology/` 新增生成器 → `types.ts` 扩展 → `engine.ts` 调用 |
| 添加新的患者画像 | `twin/profiles/` 新增 → `profiles/index.ts` 注册 |
| 添加新的 API 端点 | `core/trpc/routers/` 新增 → `_app.ts` 注册 → `shared-types/schemas/` schema |
| 修改数据库表 | `core/db/schema.ts` 或 `core/db/schema/` 模块 → `pnpm db:generate` → `pnpm db:migrate` |
| 修改仪表盘 UI | `web/src/pages/DashboardPage.tsx` 或 `web/src/pages/` 各页面 |
| 修改居家地图渲染 | `web/src/twin/HomeMapCanvas.tsx` + `web/src/twin/ThingRenderer.tsx` |
| 修改数字孪生行为 | `twin/behavior.ts` (引擎) + `twin/pathfinding.ts` / `twin/nav-mesh.ts` / `twin/instruction.ts` |
| 添加新 Thing/家具类型 | `shared-types/src/home-map/things/registry.ts` |
| 修改地图编辑器 | `web/src/twin/Editor/` |
| 修改 WebSocket 消息 | `core/realtime/broadcast.ts` (服务端) + `web/src/hooks/useRealtime.ts` (客户端) |
| 修改 Zustand Store | `web/src/store/` |
| 修改 CI/CD | `.github/workflows/` |
| 修改 MQTT 接入 | `mqtt-ingest/` |
| 修改 Docker 部署 | `docker-compose.yml` |
| 修改环境变量 | `apps/server/src/env.ts` → `.env.example` |
| 修改认证逻辑 | `core/trpc/middleware/auth.ts` + `core/lib/jwt.ts` + `core/lib/password.ts` |
| 修改 PIN 管理 | `core/trpc/routers/pin.ts` + `core/db/schema/pin.ts` |

### 关键类型定义

| 类型 | 位置 |
|------|------|
| `AppRouter` (tRPC 全类型) | `server/src/core/trpc/routers/_app.ts` |
| `PatientProfile` | `server/src/twin/types.ts` |
| `SimulatedEvent` | `server/src/twin/types.ts` |
| `HomeMap` | `shared-types/src/home-map/types.ts` |
| `Thing` / `DetectedRoom` / `Tile` | `shared-types/src/home-map/types.ts` |
| `SpriteDef` | `shared-types/src/home-map/types.ts` |
| `EntityState` (Zustand) | `web/src/store/entityState.ts` |
| `ServerMessage` (WS 协议) | `server/src/core/realtime/broadcast.ts` |
| Zod Schemas | `packages/shared-types/src/schemas/` |
| DB Schema | `server/src/core/db/schema.ts` + `server/src/core/db/schema/` |

### 常用开发流程

**添加新患者画像:**
1. `twin/profiles/<new>.ts` — Profile 常量
2. `twin/profiles/index.ts` — 注册
3. `server/src/index.ts` — Demo bootstrap 添加

**添加新生理指标:**
1. `twin/physiology/<new>.ts` — 生成器
2. `twin/types.ts` — 扩展 baseline
3. `twin/engine.ts` — tick 调用

**添加新 Thing/家具:**
1. `shared-types/src/home-map/things/registry.ts` — 添加 ThingDef
2. `shared-types/src/home-map/things/placement.ts` — 可选: 放置规则

**扩展 tRPC API:**
1. `shared-types/src/schemas/` — Zod schema
2. `core/trpc/routers/<name>.ts` — procedure
3. `core/trpc/routers/_app.ts` — 注册

**添加新 Zustand Store:**
1. `web/src/store/<name>.ts` — `create()` 定义
2. `web/src/StoreProvider.tsx` — 初始化逻辑（如需要服务端数据）
