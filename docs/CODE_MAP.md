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
| 设备 CRUD (列表/详情/创建/编辑/删除/开关) | ✅ | `core/trpc/routers/device.ts` |
| 告警管理 (列表/确认/解决) | ✅ | `core/trpc/routers/alert.ts` |
| 时序数据查询 (最新/时间序列) | ✅ | `core/trpc/routers/data.ts` |
| 告警阈值配置 (按患者定制) | ✅ | `core/trpc/routers/alertRule.ts` |
| 地图配置 CRUD (保存/加载) | ✅ | `core/trpc/routers/mapConfig.ts` |
| 实时仪表盘 (患者卡片 + 告警时间线) | ✅ | `web/src/App.tsx` |
| 指标切换器 (基础/血压/血糖/体动) | ✅ | `web/src/App.tsx` |
| 趋势分析 (时序折线图 + 告警标记) | ✅ | `web/src/pages/TrendsPage.tsx` |
| 资产浏览器 (2D/3D 精灵预览) | ✅ | `web/src/pages/AssetManagerPage.tsx` |
| Ward 管理 (创建/删除/暂停/调速/选择) | ✅ | `web/src/pages/WardManagementPage.tsx` |

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
| `useWardStore` | 选中 Ward、运行状态、WS 连接 | `web/src/store/ward.ts` |
| `usePatientStore` | 患者列表共享、选中患者 | `web/src/store/patients.ts` |
| `useEntityStateStore` | 实体位置/姿态（WS 写入） | `web/src/store/entityState.ts` |
| `StoreProvider` | 单例初始化所有 Store | `web/src/StoreProvider.tsx` |

### 仿真引擎

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| 仿真时钟 (加速/暂停/恢复) | ✅ | `simulator/clock.ts` |
| 病房管理 (创建/暂停/恢复/调速/删除) | ✅ | `simulator/engine.ts` |
| 患者画像: 老年心血管 | ✅ | `simulator/profiles/elderly-cardiac.ts` |
| 患者画像: 术后恢复 | ✅ | `simulator/profiles/post-surgery.ts` |
| 患者画像: 糖尿病 | ✅ | `simulator/profiles/diabetes.ts` |
| 患者画像: COPD 呼吸疾病 | ✅ | `simulator/profiles/copd-respiratory.ts` |
| 患者画像: 孕产监护 | ✅ | `simulator/profiles/maternity.ts` |
| 画像注册表 + 查询 | ✅ | `simulator/profiles/index.ts` |
| 心率生成器 (高斯噪声 + 昼夜 + 活动) | ✅ | `simulator/physiology/vitals.ts` |
| 呼吸率生成器 | ✅ | `simulator/physiology/vitals.ts` |
| 体温生成器 (昼夜节律) | ✅ | `simulator/physiology/vitals.ts` |
| 血氧生成器 | ✅ | `simulator/physiology/vitals.ts` |
| 离床状态生成器 | ✅ | `simulator/physiology/vitals.ts` |
| 血压生成器 (收缩/舒张) | ✅ | `simulator/physiology/blood-pressure.ts` |
| 血糖生成器 (餐后曲线模型) | ✅ | `simulator/physiology/glucose.ts` |
| 体动指数生成器 | ✅ | `simulator/physiology/motion.ts` |
| 姿势状态机 (躺/坐/站/走) | ✅ | `simulator/physiology/posture.ts` |
| ECG 心电波形合成器 | ✅ | `simulator/physiology/ecg-waveform.ts` |
| 呼吸波形生成器 | ✅ | `simulator/physiology/respiratory-waveform.ts` |
| 体压分布生成器 (4x4 网格) | ✅ | `simulator/physiology/pressure-distribution.ts` |
| 场景注入 (9 种) | ✅ | `simulator/engine.ts` → `injectScenario` |
| 实体位置广播 (按患者活动) | ✅ | `simulator/engine.ts` → entityStates |
| Demo 模式 (自动创建病房+种子账号) | ✅ | `server/src/index.ts` → `bootstrap()` |

### MQTT 设备接入

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| MQTT 客户端连接/订阅 | ✅ | `ingest/mqtt/index.ts` |
| 智能床垫模块 (协调器) | ✅ | `ingest/mqtt/mattress/index.ts` |
| 床垫载荷解析 | ✅ | `ingest/mqtt/mattress/parser.ts` |
| 睡眠状态机 (0/1/2/3) | ✅ | `ingest/mqtt/mattress/sleep-state.ts` |
| 阈值告警引擎 (心率/呼吸/离床/压疮) | ✅ | `ingest/mqtt/mattress/alerts.ts` |

### TCP 设备接入

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| TCP 服务器 (端口 5858) | ✅ | `ingest/tcp/index.ts` |
| MessagePack 解码 (0xAB 0xCD) | ✅ | `ingest/tcp/index.ts` |
| TLV 解码 (fallback) | ✅ | `ingest/tcp/index.ts` |

### 地图系统 (Prison Architect 风格)

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| 三层数据模型 (Grid/Zone/Object) | ✅ | `shared-types/src/map/types.ts` |
| 资产注册表 (14 种 EntityDef) | ✅ | `shared-types/src/map/registries.ts` |
| 精灵/模型资产定义 (AssetDef) | ✅ | `shared-types/src/map/assets.ts` |
| 栅格构建 (Zone→Tile 推导) | ✅ | `shared-types/src/map/grid.ts` |
| Edge 墙壁生成 (0.15m 厚) | ✅ | `shared-types/src/map/grid.ts` |
| A* 寻路 | ✅ | `shared-types/src/map/pathfinding.ts` |
| 放置校验 (canPlaceEntity) | ✅ | `shared-types/src/map/validation.ts` |
| 行为引擎 (idle/moving/acting 三态) | ✅ | `shared-types/src/map/behavior.ts` |
| 地图工厂 (createDefaultMap) | ✅ | `shared-types/src/map/factory.ts` |
| 2D SVG 渲染器 (含网格+标签) | ✅ | `web/src/map/MapRenderer2D.tsx` |
| 3D R3F 渲染器 (含 Billboard 回退) | ✅ | `web/src/map/MapRenderer3D.tsx` |
| 地图编辑器 (画房间/放实体/保存) | ✅ | `web/src/map/editor/MapEditorPage.tsx` |
| 实体属性面板 (患者关联/朝向/删除) | ✅ | `web/src/map/editor/PropertiesPanel.tsx` |
| 工具栏 (选择/画房间/放实体/保存) | ✅ | `web/src/map/editor/Toolbar.tsx` |
| 编辑画布 (拖拽/右键删区/双击改名) | ✅ | `web/src/map/editor/MapCanvas2D.tsx` |

### 3D 渲染组件

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| 区域地板 (ZoneFloor) | ✅ | `web/src/map/renderers/ZoneFloor.tsx` |
| 墙壁网格 (WallMesh, 0.15m 厚) | ✅ | `web/src/map/renderers/WallMesh.tsx` |
| 床实体 (Bed3D) | ✅ | `web/src/map/renderers/Bed3D.tsx` |
| 人物实体 (Person3D, 服务端位置) | ✅ | `web/src/map/renderers/Person3D.tsx` |
| 设备标记 (DeviceMarker3D) | ✅ | `web/src/map/renderers/DeviceMarker3D.tsx` |
| Billboard 回退 (2D→3D 精灵) | ✅ | `web/src/map/renderers/Billboard3D.tsx` |
| 仿真数据 Hook (useSimData) | ✅ | `web/src/3d/hooks/useSimData.ts` |
| 数字孪生页面 | ✅ | `web/src/pages/DigitalTwinPage.tsx` |

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
│   │   └── schema.ts           # 8 表: users, refresh_tokens, patients, devices, events, ingest_raw_data, audit_logs, map_configs
│   ├── lib/
│   │   ├── jwt.ts              # JWT 签名/验证
│   │   └── password.ts         # Argon2 密码哈希
│   ├── realtime/
│   │   └── broadcast.ts        # WebSocket 广播管理器 (按 Ward 订阅, 实体状态 + 体征)
│   └── trpc/
│       ├── context.ts           # tRPC 上下文 (db, req)
│       ├── init.ts              # tRPC 实例
│       ├── index.ts             # 导出: initTRPC, publicProcedure, protectedProcedure
│       ├── middleware/
│       │   └── auth.ts          # Bearer Token 中间件
│       └── routers/
│           ├── _app.ts          # 根路由器 (9 个子路由器)
│           ├── auth.ts          # register, login, refresh
│           ├── user.ts          # list, me, update
│           ├── patient.ts       # list, byId, create, update, delete
│           ├── device.ts        # list, byId, create, update, delete
│           ├── alert.ts         # list, acknowledge, resolve
│           ├── data.ts          # timeseries, latest, ingest
│           ├── alertRule.ts     # byPatient, upsert (自定义阈值)
│           ├── mapConfig.ts     # get, save (地图 JSON 存储)
│           └── thresholds.ts    # 默认阈值 (5 种患者画像)
│
├── simulator/
│   ├── index.ts                 # 公共导出
│   ├── clock.ts                 # 仿真时钟 (可调速)
│   ├── engine.ts                # 仿真引擎: 病房管理, tick, 场景注入, 实体状态广播
│   ├── factory.ts               # 患者/设备 DB 工厂
│   ├── types.ts                 # PatientProfile, PatientInstance, SimulatedEvent, WardState
│   ├── profiles/                # 5 种患者画像 (elderly-cardiac, post-surgery, diabetes, copd-respiratory, maternity)
│   ├── physiology/              # 12 种生理生成器 (vitals, blood-pressure, glucose, motion, posture, ecg-waveform, respiratory-waveform, pressure-distribution)
│   └── trpc/
│       └── simulator.ts         # createWard, pause, resume, setSpeed, status, injectScenario, delete
│
└── ingest/
    ├── index.ts
    ├── mqtt/                    # MQTT 客户端 + 智能床垫解析
    └── tcp/                     # TCP 服务器 (端口 5858)
```

### `apps/web/` — Web 仪表盘

```
src/
├── main.tsx                     # React 入口
├── App.tsx                      # 主应用: 登录门控, Tab 导航 (8 标签), 仪表盘视图
├── LoginPage.tsx                # 登录/注册
├── trpc.ts                      # tRPC 客户端 + Token 刷新
├── StoreProvider.tsx            # Zustand Store 统一初始化 (患者/Ward/WS)
│
├── store/
│   ├── auth.ts                  # useAuthStore (JWT 令牌)
│   ├── ward.ts                  # useWardStore (选中 Ward + 运行状态 + WS 连接)
│   ├── patients.ts              # usePatientStore (患者列表 + 选中患者)
│   └── entityState.ts           # useEntityStateStore (实体位置/姿态/虚拟时间)
│
├── hooks/
│   └── useRealtime.ts           # WebSocket Hook (自动重连, 写入 Store, 更新 React Query)
│
├── pages/
│   ├── PatientListPage.tsx      # 患者 CRUD
│   ├── DeviceListPage.tsx       # 设备 CRUD
│   ├── DigitalTwinPage.tsx      # 数字孪生: Canvas + MapRenderer3D + 实时体征
│   ├── TrendsPage.tsx           # 趋势分析: recharts 折线图 + 告警标记
│   ├── AlertRulesPage.tsx       # 告警阈值: 按患者编辑上下限
│   ├── AssetManagerPage.tsx     # 资产管理: 浏览 14 种内置资产 + 2D/3D 预览
│   └── WardManagementPage.tsx   # Ward 管理: 创建/删除/暂停/调速/选择
│
├── map/
│   ├── useMapModel.ts           # MapModel Hook (后端加载 → 工厂回退)
│   ├── MapRenderer2D.tsx        # SVG 2D 渲染器 (资产系统 + 网格 + 区域标签)
│   ├── MapRenderer3D.tsx        # R3F 3D 渲染器 (资产系统 + Billboard 回退)
│   ├── renderers/
│   │   ├── ZoneFloor.tsx        # 3D 区域地板
│   │   ├── WallMesh.tsx         # 3D 墙壁 (0.15m 厚)
│   │   ├── Bed3D.tsx            # 3D 床
│   │   ├── Person3D.tsx         # 3D 人物 (服务端位置驱动)
│   │   ├── DeviceMarker3D.tsx   # 3D 设备标记
│   │   └── Billboard3D.tsx      # 2D→3D 精灵回退
│   └── editor/
│       ├── MapEditorPage.tsx    # 编辑器页面
│       ├── MapCanvas2D.tsx      # 交互画布 (拖拽/右键/R键/Del键)
│       ├── Toolbar.tsx          # 工具栏 (选择/画房间+类型/放实体/保存)
│       └── PropertiesPanel.tsx  # 属性面板 (患者关联/朝向/删除)
│
└── 3d/
    └── hooks/
        └── useSimData.ts         # 仿真数据 Hook (轮询回退)
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
└── map/
    ├── types.ts                 # Tile, Zone, Entity, EntityDef, MapModel, EntityRuntime, AssetDef, Sprite2D, Model3D, BehaviorProfile
    ├── registries.ts            # ENTITY_DEFS (14), ZONE_DEFS (6), INTERACTION_DEFS (3)
    ├── assets.ts                # ASSET_DEFS (14) + getAsset
    ├── grid.ts                  # buildGrid, getWallSegments, entitiesAt, isWalkable
    ├── pathfinding.ts           # findPath (A*)
    ├── validation.ts            # canPlaceEntity
    ├── behavior.ts              # updateEntityBehavior
    ├── factory.ts               # createDefaultMap (配置化默认布局)
    └── index.ts                 # 桶导出
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
| 添加新的生理指标 | `simulator/physiology/` 新增生成器 → `types.ts` 扩展 → `engine.ts` 调用 |
| 添加新的患者画像 | `simulator/profiles/` 新增 → `profiles/index.ts` 注册 |
| 添加新的 API 端点 | `core/trpc/routers/` 新增 → `_app.ts` 注册 → `shared-types/schemas/` schema |
| 修改数据库表 | `core/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate` |
| 修改仪表盘 UI | `web/src/App.tsx` (主仪表盘) 或 `web/src/pages/` 各页面 |
| 修改 3D 场景 | `web/src/map/MapRenderer3D.tsx` + `web/src/map/renderers/` |
| 修改数字孪生行为 | `shared-types/src/map/behavior.ts` (引擎) + `simulator/engine.ts` (服务端调用) |
| 添加新实体/家具类型 | `shared-types/src/map/registries.ts` (EntityDef) + `assets.ts` (AssetDef) |
| 添加新地图资产 | `shared-types/src/map/assets.ts` (ASSET_DEFS) |
| 修改地图编辑器 | `web/src/map/editor/` |
| 修改 WebSocket 消息 | `core/realtime/broadcast.ts` (服务端) + `web/src/hooks/useRealtime.ts` (客户端) |
| 修改 Zustand Store | `web/src/store/` |
| 修改 CI/CD | `.github/workflows/` |
| 修改 TCP 设备接入 | `ingest/tcp/index.ts` |
| 修改 Docker 部署 | `docker-compose.yml` |
| 修改环境变量 | `apps/server/src/env.ts` → `.env.example` |
| 修改认证逻辑 | `core/trpc/middleware/auth.ts` + `core/lib/jwt.ts` + `core/lib/password.ts` |

### 关键类型定义

| 类型 | 位置 |
|------|------|
| `AppRouter` (tRPC 全类型) | `server/src/core/trpc/routers/_app.ts` |
| `PatientProfile` | `server/src/simulator/types.ts` |
| `SimulatedEvent` | `server/src/simulator/types.ts` |
| `MapModel` | `shared-types/src/map/types.ts` |
| `EntityDef` / `Entity` | `shared-types/src/map/types.ts` |
| `AssetDef` / `Sprite2D` / `Model3D` | `shared-types/src/map/types.ts` |
| `EntityRuntime` (行为状态) | `shared-types/src/map/types.ts` |
| `EntitySchedule` | `shared-types/src/map/types.ts` |
| `BehavioralProfile` | `shared-types/src/map/types.ts` |
| `SimPatientData` (前端患者数据) | `web/src/3d/hooks/useSimData.ts` |
| `EntityState` (Zustand) | `web/src/store/entityState.ts` |
| `ServerMessage` (WS 协议) | `server/src/core/realtime/broadcast.ts` |
| Zod Schemas | `packages/shared-types/src/schemas/` |
| DB Schema (8 表) | `server/src/core/db/schema.ts` |

### 常用开发流程

**添加新患者画像:**
1. `simulator/profiles/<new>.ts` — Profile 常量
2. `simulator/profiles/index.ts` — 注册
3. `server/src/index.ts` — Demo bootstrap 添加

**添加新生理指标:**
1. `simulator/physiology/<new>.ts` — 生成器
2. `simulator/types.ts` — 扩展 baseline
3. `simulator/engine.ts` — tickWard() 调用

**添加新实体/家具:**
1. `shared-types/src/map/assets.ts` — 添加 AssetDef (sprite2D + model3D)
2. `shared-types/src/map/registries.ts` — 添加 EntityDef (引用 assetId)
3. 可选: `web/src/map/MapRenderer3D.tsx` — KNOWN_3D 映射自定义 3D 组件

**扩展 tRPC API:**
1. `shared-types/src/schemas/` — Zod schema
2. `core/trpc/routers/<name>.ts` — procedure
3. `core/trpc/routers/_app.ts` — 注册

**添加新 Zustand Store:**
1. `web/src/store/<name>.ts` — `create()` 定义
2. `web/src/StoreProvider.tsx` — 初始化逻辑（如需要服务端数据）
