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
| 实时仪表盘 (患者卡片 + 告警时间线) | ✅ | `web/src/App.tsx` |
| 指标切换器 (基础/血压/血糖/体动) | ✅ | `web/src/App.tsx` |

### 仿真引擎

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| 仿真时钟 (加速/暂停/恢复) | ✅ | `simulator/clock.ts` |
| 病房管理 (创建/暂停/恢复/调速) | ✅ | `simulator/engine.ts` → `createWard/pauseWard/resumeWard` |
| 患者画像: 老年心血管 | ✅ | `simulator/profiles/elderly-cardiac.ts` |
| 患者画像: 术后恢复 | ✅ | `simulator/profiles/post-surgery.ts` |
| 患者画像: 糖尿病 | ✅ | `simulator/profiles/diabetes.ts` |
| 患者画像: COPD 呼吸疾病 | ✅ | `simulator/profiles/copd-respiratory.ts` |
| 患者画像: 孕产监护 | ✅ | `simulator/profiles/maternity.ts` |
| 画像注册表 + 查询 | ✅ | `simulator/profiles/index.ts` |
| 心率生成器 (高斯噪声 + 昼夜 + 活动) | ✅ | `simulator/physiology/vitals.ts` → `generateHeartRate` |
| 呼吸率生成器 | ✅ | `simulator/physiology/vitals.ts` → `generateRespiratoryRate` |
| 体温生成器 (昼夜节律) | ✅ | `simulator/physiology/vitals.ts` → `generateTemperature` |
| 血氧生成器 | ✅ | `simulator/physiology/vitals.ts` → `generateSpO2` |
| 离床状态生成器 | ✅ | `simulator/physiology/vitals.ts` → `generateBedStatus` |
| 血压生成器 (收缩/舒张) | ✅ | `simulator/physiology/blood-pressure.ts` |
| 血糖生成器 (餐后曲线模型) | ✅ | `simulator/physiology/glucose.ts` |
| 体动指数生成器 | ✅ | `simulator/physiology/motion.ts` |
| 姿势状态机 (躺/坐/站/走) | ✅ | `simulator/physiology/posture.ts` |
| ECG 心电波形合成器 | ✅ | `simulator/physiology/ecg-waveform.ts` |
| 呼吸波形生成器 | ✅ | `simulator/physiology/respiratory-waveform.ts` |
| 体压分布生成器 (4x4 网格) | ✅ | `simulator/physiology/pressure-distribution.ts` |
| 场景注入 (9 种: 离床/心动过速/跌倒/低血氧/高血糖/低血糖/低血压/心律失常/呼吸窘迫) | ✅ | `simulator/engine.ts` → `injectScenario` |
| Demo 模式 (自动创建病房+种子账号) | ✅ | `server/src/index.ts` → `bootstrap()` |

### MQTT 设备接入

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| MQTT 客户端连接/订阅 | ✅ | `ingest/mqtt/index.ts` |
| 智能床垫模块 (协调器) | ✅ | `ingest/mqtt/mattress/index.ts` |
| 床垫载荷解析 | ✅ | `ingest/mqtt/mattress/parser.ts` |
| 睡眠状态机 (0/1/2/3) | ✅ | `ingest/mqtt/mattress/sleep-state.ts` |
| 阈值告警引擎 (心率/呼吸/离床/压疮) | ✅ | `ingest/mqtt/mattress/alerts.ts` |

### Web 3D 数字孪生

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| R3F Canvas 容器 | ✅ | `web/src/pages/DigitalTwinPage.tsx` |
| 瓦片网格房间布局定义 (5 房间) | ✅ | `web/src/3d/layouts/homeLayout.ts` |
| 程序化房间生成器 (墙壁/地板/门窗) | ✅ | `web/src/3d/rooms/RoomGenerator.tsx` |
| 全屋场景容器 | ✅ | `web/src/3d/scenes/HomeScene.tsx` |
| 人物实体 (体位动画 + 生命体征悬浮) | ✅ | `web/src/3d/entities/Person.tsx` |
| 床实体 + 体压热力图 | ✅ | `web/src/3d/entities/Bed.tsx` + `PressureHeatmap.tsx` |
| 设备标记 (状态环 + 告警脉冲) | ✅ | `web/src/3d/entities/DeviceMarker.tsx` |
| 仿真数据 Hook (2s 轮询) | ✅ | `web/src/3d/hooks/useSimData.ts` |

### 微信小程序

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| 首页九宫格 | ✅ | `miniapp/src/pages/index/index.tsx` |
| 微信登录 (模拟) | ✅ | `miniapp/src/pages/login/index.tsx` |
| 告警列表 | ✅ | `miniapp/src/pages/alerts/index.tsx` |
| 设备列表 | ✅ | `miniapp/src/pages/devices/index.tsx` |
| 数据查看器 (生命体征 + 患者选择) | ✅ | `miniapp/src/pages/data/index.tsx` |
| 设置页 (服务地址/连接测试) | ✅ | `miniapp/src/pages/settings/index.tsx` |
| tRPC 客户端适配 (Taro.request) | ✅ | `miniapp/src/utils/trpc.ts` |

### Flutter 实验工具

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| MQTT 控制台 (话题发送 + 日志) | ✅ | `flutter/lib/pages/mqtt_console_page.dart` |
| YOLO 跌倒检测 (摄像头 + TFLite) | ✅ | `flutter/lib/pages/vision_page.dart` |
| IMU 运动监测 (加速度/陀螺波形) | ✅ | `flutter/lib/pages/imu_page.dart` |
| 设置页 (MQTT 代理配置) | ✅ | `flutter/lib/pages/settings_page.dart` |
| MQTT 服务封装 | ✅ | `flutter/lib/services/mqtt_service.dart` |

### TCP 设备接入

| 功能 | 状态 | 入口文件 |
|------|------|---------|
| TCP 服务器 (端口 5858) | ✅ | `ingest/tcp/index.ts` → `startTcpIngest` |
| MessagePack 解码 (0xAB 0xCD) | ✅ | `ingest/tcp/index.ts` → `decodeMsgpack` |
| TLV 解码 (fallback) | ✅ | `ingest/tcp/index.ts` → `decodeTLV` |

---

## 文件导航 (File Map)

### `apps/server/` — 后端服务

```
src/
├── index.ts                    # 应用入口: Hono 服务器启动, CORS, tRPC 挂载, Demo bootstrap, MQTT 初始化
├── env.ts                      # Zod 环境变量验证 (PORT, DATABASE_URL, JWT_SECRET, DEMO_MODE 等)
│
├── core/                       # 核心有界上下文
│   ├── db/
│   │   ├── index.ts            # Drizzle ORM 客户端初始化 (postgres driver)
│   │   └── schema.ts           # 数据库 Schema 定义: 7 表 (users, refresh_tokens, patients, devices, events, ingest_raw_data, audit_logs), 6 枚举
│   ├── lib/
│   │   ├── jwt.ts              # JWT 签名/验证 (access + refresh tokens)
│   │   └── password.ts         # Argon2 密码哈希/验证
│   ├── services/               # (空目录 — 轻量CRUD直接在router中实现)
│   └── trpc/
│       ├── context.ts           # tRPC 上下文创建 (注入 db, req)
│       ├── init.ts              # tRPC 实例 + 路由器类型
│       ├── index.ts             # 重新导出: initTRPC, publicProcedure, protectedProcedure
│       ├── middleware/
│       │   └── auth.ts          # Bearer Token 验证中间件, 注入 userId/role
│       └── routers/
│           ├── _app.ts          # 根路由器: 组合所有子路由器 + 类型导出 (AppRouter)
│           ├── auth.ts          # 认证路由: register, login, refresh
│           ├── user.ts          # 用户路由: list, me, update
│           ├── patient.ts       # 患者路由: list, byId, create, update, delete
│           ├── device.ts        # 设备路由: list, byId, create, update, delete, toggleStatus
│           ├── alert.ts         # 告警路由: list, acknowledge, resolve
│           └── data.ts          # 数据路由: timeseries, latest, ingest
│
├── simulator/                   # 仿真有界上下文
│   ├── index.ts                 # 公共导出
│   ├── clock.ts                 # 仿真时钟 (加速时间, tick 计数)
│   ├── engine.ts                # 仿真引擎核心: 病房创建, tick 循环 (生成 12 种指标), 场景注入, 暂停/恢复/调速
│   ├── factory.ts               # 患者/设备数据库工厂 (创建 DB 记录)
│   ├── types.ts                 # 仿真类型定义: PatientProfile, PatientInstance, SimulatedEvent, WardState, Posture, SCENARIO_TYPES
│   ├── profiles/
│   │   ├── index.ts             # 画像注册表 (profiles 字典 + getProfile 查询)
│   │   ├── elderly-cardiac.ts   # 老年心血管患者画像
│   │   ├── post-surgery.ts      # 术后恢复患者画像
│   │   ├── diabetes.ts          # 糖尿病患者画像
│   │   ├── copd-respiratory.ts  # COPD 呼吸疾病患者画像
│   │   └── maternity.ts         # 孕产监护画像
│   ├── physiology/
│   │   ├── vitals.ts            # 基础生理生成器: 心率, 呼吸率, 体温, 血氧, 离床状态
│   │   ├── blood-pressure.ts    # 血压生成器 (收缩压/舒张压)
│   │   ├── glucose.ts           # 血糖生成器 (餐后曲线模型)
│   │   ├── motion.ts            # 体动指数生成器
│   │   ├── posture.ts           # 姿势状态机 (躺/坐/站/走 转移概率)
│   │   ├── ecg-waveform.ts      # ECG 波形合成器 (P-QRS-T 高斯合成)
│   │   ├── respiratory-waveform.ts # 呼吸波形生成器 (基波+谐波+噪声)
│   │   └── pressure-distribution.ts # 体压分布生成器 (4x4 网格)
│   └── trpc/
│       └── simulator.ts         # 仿真 tRPC 路由: createWard, pause, resume, setSpeed, status, injectScenario
│
└── ingest/                      # MQTT 接入有界上下文
    ├── index.ts                 # 公共导出 + startMqttIngest 入口
    ├── mqtt/
    │   ├── index.ts             # MQTT 客户端: 连接 mosquitto, 订阅话题, 消息转 mattress 模块
    │   └── mattress/
    │       ├── index.ts         # MattressModule 协调器: 设备注册, 事件写入
    │       ├── parser.ts        # 智能床垫载荷解析器
    │       ├── sleep-state.ts   # 睡眠状态机 (off→on→浅睡→深睡)
    │       └── alerts.ts        # 阈值告警引擎 (连续异常计数器, 压疮风险 120min)
    └── tcp/
        └── index.ts             # TCP 设备接入: 端口 5858, MessagePack + TLV 双解码, 直连 MattressModule
```

### `apps/web/` — Web 仪表盘

```
src/
├── main.tsx                     # React 入口: MantineProvider, ModalsProvider, Notifications, App mount
├── App.tsx                      # 主应用: 登录状态, Tab 导航 (监护面板/患者管理/设备管理/数字孪生), 仪表盘视图
├── LoginPage.tsx                # 登录/注册页面
├── trpc.ts                      # tRPC 客户端: httpBatchLink, auth token 注入
├── store/
│   └── auth.ts                  # Zustand 认证状态 (token, login, logout)
├── pages/
│   ├── PatientListPage.tsx      # 患者 CRUD: 表格列表, 创建/编辑 Modal, 删除确认, 表单验证
│   ├── DeviceListPage.tsx       # 设备 CRUD: 表格列表, 创建/编辑 Modal, 删除确认, 表单验证
│   └── DigitalTwinPage.tsx      # 3D 数字孪生页面: R3F Canvas, 患者数据获取, 场景加载
└── 3d/
    ├── scenes/
    │   └── HomeScene.tsx         # 全屋场景: 渲染所有房间, 放置实体, 注入实时数据
    ├── rooms/
    │   └── RoomGenerator.tsx     # 程序化房间: 从 TileType[][] 生成墙壁/地板/门窗几何体
    ├── entities/
    │   ├── Person.tsx            # 人物: 胶囊体+球头, 姿势驱动旋转, 生命体征 Html 悬浮
    │   ├── Bed.tsx               # 床: 框架+床头板+床垫, 嵌入 PressureHeatmap
    │   ├── PressureHeatmap.tsx   # 体压热力图: 4x4 顶点颜色渐变 (蓝→绿→黄→红)
    │   └── DeviceMarker.tsx      # 设备标记: 球体+状态环, 告警脉冲动画 (useFrame)
    ├── hooks/
    │   └── useSimData.ts         # 数据 Hook: tRPC 轮询 (2s/3s), 聚合患者体征+告警
    └── layouts/
        └── homeLayout.ts         # 瓦片网格布局: 5 房间 (卧室/客厅/厨房/卫生间/走廊), 锚点定义
```

### `apps/miniapp/` — 微信小程序

```
src/
├── app.tsx                      # Taro App 入口
├── app.config.ts                # 页面注册 + 窗口配置
├── utils/
│   └── trpc.ts                  # tRPC 客户端: Taro.request 适配, auth token 存储
└── pages/
    ├── index/index.tsx           # 首页: 功能九宫格 (数据/告警/设备/设置)
    ├── login/index.tsx           # 登录: 微信 code 获取, demo 回退
    ├── alerts/index.tsx          # 告警列表: 严重度颜色, 时间显示
    ├── data/index.tsx            # 数据查看: 患者选择器, 生命体征卡片
    ├── devices/index.tsx         # 设备列表: 类型图标, 状态标记
    └── settings/index.tsx        # 设置: 服务器地址修改, 连接测试
```

### `apps/flutter/` — Flutter 实验工具

```
lib/
├── main.dart                    # App 入口: GoRouter, MqttService 初始化
├── app.dart                     # MaterialApp.router 配置
├── pages/
│   ├── home_page.dart           # 首页导航
│   ├── mqtt_console_page.dart   # MQTT 控制台: 发布/订阅, 日志列表
│   ├── vision_page.dart         # YOLO 跌倒检测: Camera + TFLite 推理
│   ├── imu_page.dart            # IMU 监测: 加速度计+陀螺仪 波形图
│   └── settings_page.dart       # 设置: MQTT broker/topic 配置
├── services/
│   ├── mqtt_service.dart        # MQTT 服务: 连接/发布/订阅 封装
│   ├── imu_sensor_service.dart  # IMU 传感器: 流式加速度/陀螺数据
│   └── mqtt_models.dart         # MQTT 消息模型
└── widgets/
    └── imu_waveform.dart        # 波形绘制组件
```

### `packages/shared-types/` — 共享类型

```
src/
├── index.ts                     # 公共导出
├── constants.ts                 # 枚举: USER_ROLES, DEVICE_TYPES, ALERT_SEVERITIES, PATIENT_STATUSES
└── schemas/
    ├── auth.ts                  # Zod: registerSchema, loginSchema, tokenPairSchema
    ├── user.ts                  # Zod: userSchema, userUpdateSchema
    ├── patient.ts               # Zod: patientSchema, patientCreateSchema, patientUpdateSchema
    ├── device.ts                # Zod: deviceSchema, deviceCreateSchema, deviceUpdateSchema
    └── events.ts                # Zod: observationSchema, alertSchema, eventListInputSchema
```

### 基础设施文件

```
├── docker-compose.yml           # Docker 编排: postgres, mosquitto, server, web
├── turbo.json                   # Turborepo 任务流水线
├── biome.json                   # Biome 格式化 + lint 配置
├── tsconfig.base.json           # 共享 TypeScript 配置
├── .dockerignore                # Docker 构建排除
├── .env.example                 # 环境变量模板
├── .npmrc                       # pnpm 配置
├── .github/workflows/
│   ├── deploy-server.yml        # 服务器 CD: build → GHCR → SSH deploy
│   ├── deploy-web.yml           # Web CD: build → GHCR → SSH deploy
│   └── deploy-miniapp.yml       # 小程序 CD: pnpm build → artifact upload
└── docs/
    ├── ARCHITECTURE.md          # DDD-Lite 架构设计文档
    └── CODE_MAP.md              # 本文档
```

---

## 快速查找指南

### 我想修改...

| 目标 | 去哪 |
|------|------|
| 添加新的生理指标 | `simulator/physiology/` 新增生成器, `simulator/types.ts` 扩展 Profile, `simulator/engine.ts` 调用 |
| 添加新的患者画像 | `simulator/profiles/` 新增文件, `profiles/index.ts` 注册 |
| 添加新的 API 端点 | `core/trpc/routers/` 新增或扩展, `_app.ts` 注册, `shared-types/schemas/` 添加 schema |
| 修改数据库表 | `core/db/schema.ts`, 然后运行 `pnpm --filter @iomtea/server db:generate` |
| 修改仪表盘 UI | `web/src/App.tsx` (主仪表盘) 或 `web/src/pages/` 各页面 |
| 修改 3D 场景 | `web/src/3d/` 目录: scenes/rooms/entities/layouts |
| 修改 CI/CD | `.github/workflows/` 对应文件 |
| 修改 TCP 设备接入 | `ingest/tcp/index.ts` (服务器+解码器), 重连逻辑内置 |
| 修改 Docker 部署 | `docker-compose.yml` 和各子项目的 `Dockerfile` |
| 修改环境变量 | `apps/server/src/env.ts` 定义 schema, `.env.example` + `docker-compose.yml` 更新 |
| 修改认证逻辑 | `core/trpc/middleware/auth.ts` (中间件), `core/lib/jwt.ts` (JWT), `core/lib/password.ts` (密码) |

### 关键类型定义

| 类型 | 位置 |
|------|------|
| `AppRouter` (tRPC 全类型) | `server/src/core/trpc/routers/_app.ts` → `export type { AppRouter }` |
| `PatientProfile` (患者画像) | `server/src/simulator/types.ts` |
| `SimulatedEvent` (仿真事件) | `server/src/simulator/types.ts` |
| `ScenarioType` (场景注入类型) | `server/src/simulator/types.ts` → `SCENARIO_TYPES` |
| `SimPatientData` (前端患者数据) | `web/src/3d/hooks/useSimData.ts` |
| `RoomLayout` / `AnchorDef` (3D 房间) | `web/src/3d/layouts/homeLayout.ts` |
| Zod Schemas (共享验证) | `packages/shared-types/src/schemas/` |
| DB Schema (7 表) | `server/src/core/db/schema.ts` |

### 常用开发流程

**添加新患者画像:**
1. `simulator/profiles/<new>.ts` — 定义 Profile 常量
2. `simulator/profiles/index.ts` — 注册到 `profiles` 字典
3. `server/src/index.ts` — (可选) 在 Demo bootstrap 中添加

**添加新生理指标:**
1. `simulator/physiology/<new>.ts` — 纯函数生成器
2. `simulator/types.ts` — 扩展 `PatientProfile.baseline`
3. `simulator/engine.ts` — `tickWard()` 中调用, 写入 events
4. `web/src/App.tsx` — 仪表盘显示新指标

**扩展 tRPC API:**
1. `packages/shared-types/src/schemas/` — 定义 Zod schema
2. `core/trpc/routers/<name>.ts` — 实现 procedure
3. `core/trpc/routers/_app.ts` — 注册子路由器
4. `web/src/` — 使用 `trpc.<name>.<procedure>.useMutation/useQuery`
