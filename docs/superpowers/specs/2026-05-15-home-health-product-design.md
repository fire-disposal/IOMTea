# 居家健康管理平台 — 产品设计方案

> 版本：v1.0
> 日期：2026-05-15
> 状态：初稿 / 待审阅

---

## 目录

1. [产品愿景与用户画像](#1-产品愿景与用户画像)
2. [系统架构总览](#2-系统架构总览)
3. [社区管理端（Web）](#3-社区管理端web)
4. [用户个人端（Taro 小程序）](#4-用户个人端taro-小程序)
5. [Flutter PIN 终端](#5-flutter-pin-终端)
6. [健康记录功能设计](#6-健康记录功能设计)
7. [数字孪生系统重设计](#7-数字孪生系统重设计)
8. [健康数据耦合设计](#8-健康数据耦合设计)
9. [IoT PIN 码系统](#9-iot-pin-码系统)
10. [实施路线图](#10-实施路线图)

---

## 1. 产品愿景与用户画像

### 1.1 产品定位

**居家健康管理平台** — 连接长者/患者、家庭成员、签约医生、设备运维的综合健康管理平台。以家庭为基本单元，以健康记录为核心载体，以异常告警为驱动线索，以数字孪生为可视化底座。

### 1.2 核心原则

| 原则 | 说明 |
|------|------|
| **家庭优先** | 以家庭为单位组织数据，而非以患者个体 |
| **记录闭环** | 采集→记录→分析→告警→干预→回访 |
| **多端协同** | 小程序（日常）、Web（管理）、Flutter（采集） |
| **被动优先** | 传感器自动采集为主，人工录入为辅 |
| **异常驱动** | 正常时呈现摘要，异常时主动推送 |

### 1.3 用户画像

```
┌─ 长者/患者 ─────────────────────────┐
│  年龄 65+，慢性病管理               │
│  使用端：Taro 小程序（子女协助）    │
│  核心需求：                          │
│  · 自动采集（设备无感）             │
│  · 一键 SOS                         │
│  · 用药提醒 + 确认                  │
└──────────────────────────────────────┘

┌─ 家庭成员/看护人 ──────────────────┐
│  子女、配偶、护工                   │
│  使用端：Taro 小程序（主要）+ Web   │
│  核心需求：                          │
│  · 远程查看父母健康状态             │
│  · 异常告警即时通知                 │
│  · 代为记录（血糖/体重/用药）       │
│  · 医生沟通                         │
└──────────────────────────────────────┘

┌─ 签约医生/健康管理师 ──────────────┐
│  社区卫生中心、养老机构             │
│  使用端：Web 社区管理端             │
│  核心需求：                          │
│  · 管辖对象健康总览                 │
│  · 异常干预（在线/上门）            │
│  · 随访记录                         │
│  · 用药调整建议                     │
└──────────────────────────────────────┘

┌─ 机构管理员 ────────────────────────┐
│  养老机构/社区健康中心 IT 管理       │
│  使用端：Web 社区管理端             │
│  核心需求：                          │
│  · 设备台账管理                     │
│  · 数据报表                         │
│  · 权限分配                         │
└──────────────────────────────────────┘

┌─ 设备运维 ──────────────────────────┐
│  安装/维护传感器设备                │
│  使用端：Flutter 工具 + Web         │
│  核心需求：                          │
│  · 设备安装/调试/诊断               │
│  · 固件升级                         │
│  · 信号诊断                         │
└──────────────────────────────────────┘
```

---

## 2. 系统架构总览

### 2.1 部署拓扑

```
┌─────────────────────────────────────────────────────────────────┐
│                       云服务端                                  │
│  ┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Web 社区管理 │  │ tRPC API │  │ 仿真引擎  │  │  MQTT 监听  │  │
│  │ (React)      │  │ (Hono)   │  │          │  │ (PIN 路由)  │  │
│  └─────────────┘  └────┬─────┘  └──────────┘  └──────┬──────┘  │
│                        │                              │         │
│                   ┌────▼─────┐                  ┌─────▼──────┐ │
│                   │ PostgreSQL │                  │  MQTT Broker│ │
│                   └──────────┘                  └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                          │                           │
           ┌──────────────┼───────────────┐           │
           ▼              ▼               ▼           ▼
┌──────────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐
│ Taro 小程序      │ │ Web 社区管理 │ │ Flutter  │ │ IoT 传感器   │
│ (家庭主入口)      │ │ (签约医生)   │ │ (PIN终端)│ │ (床垫/IMU等) │
└──────────────────┘ └────────────┘ └──────────┘ └──────────────┘
```

### 2.2 边界上下文（DDD-Lite v2）

```
apps/server/src/
├── core/                          # 上下文：核心业务
│   ├── db/schema/                 # 拆分多 schema 文件
│   │   ├── base.ts                # users, patients（devices 已废弃）
│   │   ├── household.ts           # 新增：households, household_members
│   │   ├── health-records.ts      # 新增：blood_glucose, weight_measurements
│   │   ├── medication.ts          # 已有：用药
│   │   ├── appointment.ts         # 已有：预约
│   │   ├── twin.ts                # 已有：数字孪生
│   │   └── events.ts              # 已有：事件总线
│   ├── services/
│   ├── realtime/
│   └── trpc/routers/
│
├── mqtt-ingest/                    # PIN→events MQTT 监听
│   ├── listener.ts                # MQTT 订阅 users/+/+/+
│   └── router.ts                  # topic 解析 → 查 PIN → events 写入
│
├── twin/                           # 上下文：数字孪生引擎
│   ├── engine.ts                  # tick
│   └── graph-engine.ts            # 图状态维护
│
└── analytics/                     # 健康分析上下文
    ├── daily-report.ts            # 健康日报聚合
    ├── trends.ts                  # 趋势分析
    └── alerts.ts                  # 告警规则引擎
```

### 2.3 核心领域模型（新增）

```
households
├── id, name, address, created_at
├── members ─── household_members
│               ├── user_id, household_id
│               ├── role: 'owner'|'member'|'guardian'
│               └── is_primary: boolean
│
├── patients ─── patients (已有)
│               └── household_id (新增 FK)
│
├── users_pin ── PIN 码表（取代 devices）
│               ├── pin, user_id, label, nickname
│               └── thing_id (可选, 关联地图 Thing)
│
└── home_maps ── 居家地图（每患者一个）

health_records (新增聚合)
├── blood_glucose
│   ├── patient_id, recorded_at
│   ├── value_mgdl: number
│   ├── context: 'fasting'|'postprandial'|'bedtime'|'random'
│   ├── source: 'manual'|'device' (导入)
│   └── tags: { medication_before?, meal_tag?, ... }
│
├── weight_measurements
│   ├── patient_id, recorded_at
│   ├── weight_kg: number
│   ├── body_fat_pct?: number
│   ├── source: 'manual'|'device'
│   └── tags: { pin_code?, ... }
│
├── blood_pressure (复用 events 表 + 结构化 tags)
│
└── medication_adherence (扩展已有)
    └── 新增：family_confirmed_by, photo_proof_url
```

### 2.4 数据流架构

```
采集层                   记录层                   分析层                展示层
─────                   ─────                   ─────                ─────
传感器自动采集 ──▶  health_records  ──▶  健康日报聚合 ──▶  家庭成员小程序
                   events(events)      趋势分析          社区管理端 Web
人工录入 ────────▶  (事件总线)         异常规则引擎 ──▶  告警推送
                                                       数字孪生态势
```

---

## 3. 社区管理端（Web）

### 3.1 目标用户

签约医生、健康管理师、机构管理员

### 3.2 信息架构

```
导航                             说明
──────────────────────────────────────────────────────
📊 仪表盘        管辖对象总览、异常概览、设备在线率
├─ 管辖对象列表   按家庭组织，含健康评级
├─ 异常概览       按严重度/类型分组
└─ 设备在线率     在线/离线/异常设备数量

👥 健康档案      每个管辖对象的完整健康记录
├─ 基本信息       患者档案、家庭信息
├─ 血糖记录       趋势图、目标范围达标率
├─ 体重记录       BMI 趋势、目标设定
├─ 血压记录       收缩压/舒张压趋势
├─ 用药记录       当前用药、依从性报表
├─ 体征趋势       心率/呼吸/血氧/体温

⚠️ 异常管理      告警处置全流程
├─ 待处理         未分配告警
├─ 处理中         已分配/确认中
├─ 已完成         已处置/待复查
└─ 历史           告警复盘

📋 随访管理      上门/在线随访
├─ 待执行         今天/本周随访计划
├─ 随访记录       历史随访详情
└─ 随访模板       结构化随访表单

💊 用药管理      批量管理用药方案
├─ 用药列表       所有患者的在用药物
├─ 依从性报表     按患者/时间段统计
└─ 干预记录       用药调整历史

📡 IoT 配置      PIN 管理
├─ PIN 列表       用户/标签/昵称/最后在线
├─ 生成 PIN       分配给用户
├─ 重置 PIN       原 PIN 失效
└─ 删除 PIN       数据源作废

⚙️ 系统设置      角色/权限/配置
├─ 用户管理
├─ 角色权限
└─ 通知配置
```

### 3.3 关键交互

| 功能 | 交互方式 |
|------|---------|
| 管辖对象列表 | 卡片式，按家庭分组，健康评级颜色标识（绿/黄/红） |
| 健康趋势 | Recharts 交互式折线图，可框选时间段，标注异常点和用药事件 |
| 告警处置 | 拖拽式看板（待处理→处理中→已完成），单击展开详情 |
| 随访录入 | 结构化表单 + 模板，移动端可拍照上传 |
| 多患者对比 | 选择 2-5 名患者趋势叠加对比 |

---

## 4. 用户个人端（Taro 小程序）

### 4.1 定位变更

**从「辅助工具」变更为「家庭健康主入口」**

当前小程序仅为简单的九宫格功能入口，需全面重构为家庭端日常健康管理的核心界面。

### 4.2 信息架构

```
Tab Bar                            说明
──────────────────────────────────────────────────────────
🏠 首页          家庭健康概览
├─ 家庭成员卡片（头像 + 状态 + 最新体征摘要）
├─ 今日待办（用药提醒 + 血糖测量提醒 + 预约）
├─ 最近告警（最多 3 条）
└─ 快捷操作（记录血糖 / 记录体重 / SOS）

📊 健康         健康记录中心
├─ 选择成员（顶部切换器）
├─ 血糖                  ├─ 体重                ├─ 血压
│  ├─ 最近7天趋势        │  ├─ 最近30天趋势     │  ├─ 趋势
│  ├─ 录入新记录         │  ├─ 录入新记录       │  ├─ 录入
│  ├─ 目标范围设置       │  ├─ 目标体重设定     │  └─ 目标
│  └─ 达标率统计         │  └─ BMI 统计         │
├─ 用药（当前用药列表 + 按时确认）
└─ 体征（心率/呼吸/血氧/体温 最新+趋势）

⚠️ 消息          告警与通知
├─ 异常告警（按时间线排列）
├─ 用药提醒（未确认的剂量）
├─ 系统通知（设备离线、新周报）
└─ 医生消息（随访提醒、建议）

👤 我的          个人中心
├─ 个人资料
├─ 家庭管理（邀请成员、移除成员）
├─ PIN 设备（查看已绑定的传感器和昵称）
├─ 绑定医生（扫码或搜索）
├─ 设置（通知偏好、单位制）
└─ 帮助与反馈
```

### 4.3 关键交互设计

**血糖录入流程**（核心高频操作）：
```
首页「记录血糖」→ 选择成员 → 输入值（数字键盘）
→ 选择时段（空腹/餐后/睡前/随机）
→ 标记（用药前/用药后/有症状）
→ 确认 → 自动存入 → 显示趋势 + 达标判定
```

**用药确认流程**：
```
首页「今日待办」→ 用药卡片 → 查看详情
→ 确认服用（拍照可选）→ 记录依从
→ 漏服 → 填写原因 → 生成漏服告警通知家人
```

**健康日报查看**：
```
每日 08:00 自动生成 → 消息中心推送通知
内容：昨日血糖曲线 + 达标率 / 体重变化 / 用药依从性 / 异常事件汇总
AI 简短建议（如「血糖控制良好，保持」或「连续 3 天餐后偏高，建议复诊」）
```

---

## 5. Flutter PIN 终端

### 5.1 定位

Flutter 应用是**传感数据采集终端**，唯一功能是输入 PIN 码后向 MQTT 发布传感器数据。

### 5.2 启动流程

```
1. 打开应用 → PIN 输入界面（6 位数字键盘，大号字体）
2. 输入 4-6 位 PIN → 本地保存（下次自动填入）
3. 连接内置 MQTT 服务器地址（可手动覆盖用于测试）
4. 进入采集界面 → 显示 PIN 绑定的设备昵称
5. 开始采集 → 向 users/{pin}/{sensor_type}/{data} 发布 JSON
6. 无需验证、无需双向握手
```

### 5.3 架构

```
Flutter ←→ MQTT (内置地址 / 可手动覆盖)
            │
            ▼
         users/{pin}/{type}/{data}
            │
            ▼
         mqtt-ingest/router.ts 解析 topic
```

### 5.4 数据格式

MQTT 消息体为 JSON，由 sensor_type 决定字段：

```
users/1234/bed/data      → { metric: 'heart_rate', value: 72, unit: 'bpm', recordedAt: '...' }
users/1234/imu/motion    → { metric: 'motion_index', value: 0.3 }
users/5678/scale/weight  → { metric: 'weight_kg', value: 68.5 }
```

### 5.5 YOLO / IMU / 床垫传感器

原有床垫传感器代码已封存为独立包 `packages/legacy-mattress/`，不接入当前系统。YOLO 和 IMU 功能保留在 Flutter 端作为本地传感器数据源，不再通过 TCP/BLE 配对，而是直接通过 MQTT 的 PIN topic 上报。

---

## 6. 健康记录功能设计

### 6.1 血糖记录

**数据模型**：
```
blood_glucose {
  id: uuid
  patient_id: uuid FK
  recorded_at: timestamp with timezone
  value_mgdl: number (40-600)
  context: enum('fasting', 'postprandial', 'bedtime', 'random', 'hypo_event')
  meal_tag?: string ('breakfast', 'lunch', 'dinner', 'snack')
  medication_before?: boolean
  medication_after?: boolean
  symptoms?: string[] (可选关联症状)
  source: enum('manual', 'taro', 'import')   // 无 PIN 的手录
  // IoT 自动采集的数据走 events 表, 不经过 health_records
  notes?: text
  tags: jsonb
}
```

**前端展示**：
- 趋势图：折线图 + 目标范围阴影区（3.9-7.0 mmol/L 空腹 / <10.0 mmol/L 餐后）
- 达标率：最近 7/14/30 天达标百分比
- 分层：按 context 分组显示（空腹/餐后）
- 异常标记：低血糖事件（<3.9）红色标记，高血糖（>13.9）橙色标记
- AGP（Ambulatory Glucose Profile）聚合图

**目标范围配置**：
```
fasting: { lower: 3.9, upper: 7.0 }
postprandial: { lower: 3.9, upper: 10.0 }
bedtime: { lower: 4.0, upper: 8.0 }
```

### 6.2 体重记录

**数据模型**：
```
weight_measurement {
  id: uuid
  patient_id: uuid FK
  recorded_at: timestamp with timezone
  weight_kg: number (20-250)
  body_fat_pct?: number (5-60)
  bmi?: number (自动计算)
  source: enum('manual', 'taro')
  tags: jsonb
}
```

**前端展示**：
- 30/90 天趋势折线图
- 目标体重范围标记
- BMI 趋势 + 分类指示（偏瘦/正常/超重/肥胖）
- 体重变化速率显示（kg/月）

### 6.3 用药记录（扩展现有）

**新增字段**：
```
medications: 增加 prescribed_by, refill_reminder
medication_adherence: 增加
  - confirmed_by: enum('self', 'family', 'caregiver') 扩展
  - photo_url: text (可选服药照片证明)
  - skipped_reason: text
  - reminder_sent_at: timestamp
```

**前端展示**：
- 用药时间线（按日/周视图）
- 当前用药卡片（药品名 + 剂量 + 频次 + 下次服药时间）
- 依从性日历（绿色=已服 / 黄色=超时 / 红色=漏服）
- 漏服告警通知（推送到家庭成员）

### 6.4 健康日报

**聚合逻辑**（服务端 cron job，每日 06:00 聚合前一天数据）：

```
daily_report {
  patient_id, report_date: date
  summary: {
    blood_glucose: {
      readings_count: number
      in_range_pct: number
      hypo_events: number
      hyper_events: number
      avg_fasting: number
      avg_postprandial: number
    }
    weight: {
      latest: number
      change_30d: number
      trend: 'rising'|'stable'|'falling'
    }
    medication: {
      adherence_pct: number
      missed_doses: number
    }
    alerts: {
      total: number
      critical: number
      resolved: number
    }
    activity: {
      steps_estimate?: number
      bed_exit_count?: number
    }
  }
  ai_insight?: string    // 简短建议
  generated_at: timestamp
}
```

---

## 7. 数字孪生系统重设计

### 7.1 设计原则

以 RimWorld 为参考，采用 **Tile-Entity 单层模型**：一切空间元素都是放置在 tile 上的"东西"（Thing），房间由算法自动检测，不显式定义边界。

- 纯 2D 呈现（放弃 3D），Canvas/SVG 渲染
- 墙 = 占据 tile 的 Thing，相邻自动衔接渲染
- 门 = 占据 tile 的 Thing，可切换通行状态
- 窗 = 外墙 tile 上的 Thing，提供环境数据
- 房间 = 墙围合的连通区域，由 flood-fill 自动检测
- 户型模板 = tile 布局 + Thing 列表
- 系统内置编辑器支持上传自定义 sprite 素材

### 7.2 类比：RimWorld 模式

RimWorld 的地图模型：

```
每个 tile 有：地形(土/石/水) + 可叠加 Things(墙/门/床/设备)
墙 = 占据 tile，阻挡移动/视野
门 = 墙 tile，开/关切换通行
房间 = 任意完全被墙包围的连通 tile 区域
屋顶 = 有墙就有屋顶（自动生成）
```

我们的居家数字孪生复用同一模型：

```
每个 tile 有：floor(室内) / void(外部)  + Things(墙/门/床/空调/窗)
墙 = 占据 tile，阻挡通行
门 = 墙 tile，开/关切换
窗 = 外墙 tile，不阻挡通行，关联传感器
房间 = flood-fill 检测被墙包围的区域
出口门 = 地图边缘的一格特殊门，切换家居/外出状态
```

### 7.3 核心数据模型

```typescript
// Tile — 最小空间单元
interface Tile {
  terrain: 'indoor' | 'outdoor'     // 室内/室外
  thingId?: string                   // 该 tile 上的 Thing ID
}

// 标签值 —— 模仿 Minecraft NBT TagCompound
type TagValue = string | number | boolean | TagValue[] | { [key: string]: TagValue }
interface TagCompound {
  [key: string]: TagValue
}

// Thing — 占据 tile 的对象。所有行为通过 tags 驱动
interface Thing {
  id: string
  type: string                       // 'wall' | 'door' | 'bed' | 任意自定义

  // 占格
  tileX: number; tileY: number
  tileW: number                      // 宽度（格数，床=2, 墙=1）
  tileH: number                      // 高度（格数，床=1, 墙=1）
  rotation: 0 | 1 | 2 | 3

  // NBT 风格标签 —— 替代所有硬编码 xxxInfo 字段
  tags: TagCompound

  pinCode?: string                  // 关联 PIN（可选）
  spriteId: string                   // 渲染精灵
}

**NBT 标签设计原则**：

```
1. Thing.type 定义默认 tags（registry 中每个类型有一组默认标签）
2. 实例 tags 覆盖/扩展 type 默认 tags（类似 Minecraft 中物品的 NBT 覆盖）
3. 引擎行为的知情标签：
   - blocksMovement          → 阻挡通行（墙）
   - door.status             → 门状态切换
   - exitDoor.homeStatus     → 居家/外出
   - sensors / actuators     → 设备能力
   - connects.wall*          → 渲染衔接（运行时计算，不持久化）
4. 引擎不知情的自定义标签：
   - 上传新设备 sprite 时附带的自定义 tags
   - 引擎原样携带、不校验、不报错
   - 仅前端读取（状态显示、历史记录）
5. 类型定义 = tags 默认值模板 + sprite + 占格
   实例 tags 可添加任意新 key，无需改 schema
```

// SpriteDef — 精灵定义（内置 + 用户上传）
interface SpriteDef {
  id: string
  name: string
  category: 'structure' | 'device' | 'furnishing'
  tileW: number                      // 占格宽
  tileH: number                      // 占格高
  source: 'builtin' | 'upload'
  path: string                       // 内置=key, 上传=file URL
  color?: string                     // 降级回退颜色
}

// DetectedRoom — 自动检测的房间
interface DetectedRoom {
  id: string
  tiles: string[]                    // 包含的 tile 坐标 "x,y"
  area: number                       // tile 数
  type: RoomType                     // 根据区域占比推断
  label: string

  // 图论 — 门是房间之间的边
  doors: {                           // 本房间的门列表
    doorThingId: string
    connectsToRoomId: string         // 门另一侧的房间 ID
  }[]
}

// RoomGraph — 房间拓扑图，仅用于前端可视化展示
interface RoomGraph {
  nodes: DetectedRoom[]
  adjacency: Map<string, string[]>   // roomId → 相邻 roomId 列表（通过门连通）
  edgeDoors: Map<string, string[]>   // "roomA-roomB" → doorThingId[]
}
// 说明：RoomGraph 仅用于前端渲染房间拓扑图（如缩略图、房间连接线等）
// 寻路不依赖 RoomGraph，仍使用 tile 级 A*
```

### 7.4 关键机制

#### 墙衔接渲染（RimWorld 风格）

相邻墙 tile 自动检测 4 方向邻居，生成衔接纹理：

```
单独一面墙        ── 水平墙段      ┬─ T 型交叉
[###]             ──┬──            ──┼──
                  │ │ 垂直墙段      │
                  └─ 角墙
```

- 渲染时检测每个墙 tile 4 方向邻居是否也是 `{ blocksMovement: true }` 的 Thing
- 计算结果写入运行时缓存（不持久化到 tags），用于 sprite/瓦片图选择（共 16 种组合）
- 无连接的独立墙回退为墩柱样式

#### 房间自动检测

房间 = 被墙和门围合的连续 tile 区域。门是房间边界同时也是房间之间的连接点。

```typescript
function detectRooms(grid: Grid, things: Thing[]): { rooms: DetectedRoom[]; graph: RoomGraph }

// 填色式算法：
// 1. 遍历所有 terrain='indoor' 的未访问 tile
// 2. flood-fill（4 方向），遇到以下情况停止：
//    - blocksMovement === true 的 Thing → 墙边界
//    - isDoorConnector === true 的 Thing → 门边界，标记为"此门通往外部"
// 3. flood-fill 覆盖的 tile = 一个房间
// 4. 对每个停止于门边界的填充位置，如果门另一侧也已检测为房间，
//    则记录 doorThingId ⇄ neighborRoomId 连接
// 5. 自动推断 roomType（基于房间内的 Thing tags）：
//    - 有 'bed' tag → bedroom
//    - 有 'toilet'/'shower' tag → bathroom
//    - 有 'stove' tag → kitchen
//    - 有 exitDoor tag 的门 → 该房间为 entry
//    - 面积最大 → livingroom
//    - 走廊形（长宽比 > 3）→ hallway
// 6. 从 rooms + doors 自动构建 RoomGraph（仅用于前端可视化）：
//    graph.adjacency[roomA] = [roomB]   // 通过门连通
//    graph.edgeDoors["roomA-roomB"] = [doorId1, doorId2]  // 多个门可能连通同一对房间
```
**房间检测示意**（俯视图，`#`=墙, `+`=门, `.`=房间 tile）：
```
  #############
  #  卧室    +#      ← 卧室的门通向走廊
  #  . . . .  +#
  #  .bed. .  +#
  #  . . . .  +########
  #+++++++++++#  客厅  #
  #############  . .  #
                # . .  #
                #.sofa.#
                # . .  #
                ########
```
- `detectRooms` 填色卧室（4 个 tile）→ 遇到门 `+` 停止 → 记录"卧室⇄走廊"
- 填色走廊 → 遇到其他门 → 记录"走廊⇄客厅"、"(将来) 走廊⇄卫生间"
- 房间之间**只通过门**连接，墙两侧永远是两个房间

#### 出口门逻辑

出口门 = 特殊的门 Thing，无开合状态，只有 homeStatus 指示居家/外出：

```typescript
// 出口门 Thing.tags 示例（极简）：
{
  isDoorConnector: true,            // 门标记（房间隔断 + 可通行点）
  exitDoor: {                       // 出口门（仅此一个特殊字段）
    isExit: true,                   // 标记为住宅出口
    homeStatus: 'home',             // home | away — 用户是否在家
  },
  sensors: ['door_magnet'],         // 可选门磁传感器
}

// 引擎通过出口门检测家居状态：
// 门状态由传感器事件驱动，而非手动切换
```

出口门位于地图边缘，它所在的房间 = 玄关 (entry)。出口门外侧 tile = "外部"，不属于任何房间。`homeStatus` 由门磁传感器事件或用户手动设置。

当 `homeStatus='away'`：
- 起居行为推断暂停
- 健康日报标记"外出"
- 异常告警切换为"家庭安全模式"

#### Auto-connect 房间类型推断

放置 bed thing → 所在房间标记为 bedroom。无需用户手动指定房间类型。

```typescript
function inferRoomType(tiles: string[], things: Thing[]): RoomType {
  const types = things.map(t => t.type)
  if (types.includes('bed')) return 'bedroom'
  if (types.includes('toilet') || types.includes('shower')) return 'bathroom'
  if (types.includes('stove') || types.includes('sink')) return 'kitchen'
  // 面积最大的未分类房间 = livingroom
  // 出口门所在房间 = entry
  // 其他 = storage
}
```

### 7.5 Thing 注册表（对象体系）

**一级 — 结构 Thing**：

每个内建类型的默认 tags：

| Thing | 占格 | 默认 tags |
|-------|------|-----------|
| 墙 | 1x1 | `{ blocksMovement: true }` |
| 内门 | 1x1 | `{ isDoorConnector: true, blocksMovement: false }` |
| 出口门 | 1x1 | `{ isDoorConnector: true, blocksMovement: false, exitDoor: { isExit: true, homeStatus: 'home' }, sensors: ['door_magnet'] }` |
| 窗 | 1x1 | `{ sensors: ['window_magnet', 'temperature'] }` |
| 地板 | 1x1 | `{ walkable: true }`（默认 terrain, 非 Thing） |

**二级 — 有电子能力的设备 Thing**：

| Thing | 占格 | 默认 tags |
|-------|------|----------|
| 智能床 | 2x1 | `{ sensors: ['heart_rate', 'respiratory_rate', 'bed_exit', 'motion'] }` |
| 沙发 | 2x1 | `{ sensors: ['pressure', 'seated_hours'] }` |
| 座椅 | 1x1 | `{ sensors: ['pressure'] }` |
| 空调 | 1x1 | `{ actuators: ['ac_mode', 'temperature_setpoint'], sensors: ['temperature', 'humidity', 'power'] }` |
| 冰箱 | 1x1 | `{ sensors: ['door_open_count', 'temperature'] }` |
| 电视 | 1-2x1 | `{ sensors: ['power_state', 'screen_time'] }` |
| 灯具 | 1x1 | `{ actuators: ['light_brightness', 'light_power'] }` |
| 烟雾报警器 | 1x1 | `{ sensors: ['smoke_level'] }` |
| 燃气传感器 | 1x1 | `{ sensors: ['gas_level'] }` |

**三级 — 使用价值 Thing**（无 sensors/actuators，仅 UX 展示）：

| Thing | 默认 tags |
|-------|----------|
| 餐桌 | `{}` |
| 马桶 | `{}` |
| 淋浴 | `{}` |
| 洗手台 | `{}` |
| 衣柜 | `{}` |
| 书桌 | `{}` |

### 7.6 户型模板系统

内置模板定义 tile 布局 + Thing 放置列表：

```typescript
interface HomeTemplate {
  id: string
  label: string
  dimensions: { width: number; height: number }
  tiles: string[][]                    // 'indoor' | 'outdoor'
  things: {
    type: string
    tileX: number; tileY: number
    tileW?: number; tileH?: number
    rotation?: 0 | 1 | 2 | 3
  }[]
  exitDoorTile: { x: number; y: number }
}
```

模板生成流程：
```
createFromTemplate(id):
  1. 创建 Tile[][] —— 按模板 terrains
  2. 放置所有 Things
  3. 自动检测房间 (detectRooms)
  4. 自动推断房间类型 (inferRoomType)
  5. 输出 HomeMap { tiles, things, rooms }
```

用户编辑流程：
```
加载模板/空白图 → Paint tile（indoor/outdoor）
→ 放置墙 Thing（自动衔接）
→ 放置门/窗/设备 Thing
→ 自动检测房间 → 自动推断类型
→ 调整/确认 → 保存
```

### 7.7 行为推断（基于房间检测）

不再需要手动的图论建模。房间检测自动输出 `DetectedRoom[]`，直接用于行为分析：

```typescript
function estimateLocation(things: Thing[], lastEvents): string | null
  // 最近传感器事件所在 tile → 所在房间

function roomTransitions(events, rooms): Activity[]
  // 传感器事件序列 → 房间切换活动

function dailyRoutine(detectedRooms, activities): DailyRoutine
  // 各房间停留时长分布

function exitEvents(exitDoor, events): { leftAt: Date; returnedAt: Date }[]
  // 通过出口门状态推断外出/回家时间
```

### 7.8 资产上传编辑器

系统内置功能，允许运维/管理员上传自定义 sprite 并定义 Thing 类型。

```typescript
interface CustomSprite {
  id: string
  name: string                       // "智能床垫 Pro"
  category: 'structure' | 'device' | 'furnishing'
  tileW: number                      // 占格宽
  tileH: number                      // 占格高
  tileH: number
  spriteUrl: string                  // 上传的图片 URL
  fallbackColor: string              // 加载失败时回退颜色

  // NBT 风格默认标签 —— 定义此 Thing 的行为和能力
  defaultTags: TagCompound

  // 例如 for 智能床垫：
  // { sensors: ['heart_rate', 'respiratory_rate', 'bed_exit', 'motion'] }
  // 例如 for 自定义烟雾报警器：
  // { sensors: ['smoke_level'], blocksMovement: false }
}
```

**编辑器流程**：
```
操作路径：系统设置 → 资产管理 → 上传新素材

步骤：
1. 选择文件（PNG/SVG，建议 64x64 每格）
2. 设置占格数（宽 x 高，如床=2x1）
3. 选择类别（structure/device/furnishing）
4. 填写默认 tags（NBT 格式 JSON）
   - sensors: [...] / actuators: [...] / blocksMovement: true / 等
5. 预览 → 确认 → 入库

存储：
- 文件 → server 磁盘 / S3
- 元数据 → user_assets 表（含 defaultTags JSONB）
```

**实例化流程**：
```
palette 中选择自定义 Thing
→ 创建实例：Thing { type: 'custom:xxx', tags: deepClone(defaultTags), ... }
→ 用户可进一步修改 tags（如设定空调目标温度默认值）
→ tags 和 type 一起存入 home_things
```

**Thing palette 加载**：
```
编辑器左侧 palette = BUILTIN_THINGS.concat(userUploadedAssets)
```

### 7.9 新架构

```
packages/shared-types/src/home-map/
├── types.ts                       # Tile, Thing, DetectedRoom, SpriteDef
├── grid.ts                        # 创建/修改 tile
├── room-detection.ts              # flood-fill 房间检测
├── runtime.ts                     # 运行时实体状态
├── template-factory.ts            # 默认地图工厂
├── things/
│   ├── index.ts                   # 桶导出
│   ├── registry.ts                # 内置 Thing 定义（type → 默认 tags + sprite）
│   └── placement.ts               # 放置校验
├── templates/
│   ├── index.ts                   # 模板索引
│   ├── one-bedroom.ts             # 一室户模板
│   └── two-bedroom.ts             # 二室户模板
├── index.ts                       # 桶导出
└── __tests__/                     # 单元测试 (grid, room-detection, placement, runtime, templates)

apps/server/src/twin/
├── engine.ts                      # 仿真引擎 (tick, 场景注入)
├── scheduler.ts                   # 运行调度器
├── pathfinding.ts                 # A* 寻路
├── behavior.ts                    # 智能体行为
├── nav-mesh.ts                    # 导航网格
├── instruction.ts                 # 动作指令
├── db-writer.ts                   # 事件 DB 写入
├── types.ts                       # 类型定义
├── profiles/                      # 5 种患者画像
├── physiology/                    # 12 种生理生成器
└── trpc/
    └── twin.router.ts             # 仿真控制 tRPC

apps/web/src/twin/
├── index.ts                       # 公共导出
├── HomeMapCanvas.tsx              # 主 2D Canvas 视口
├── ThingRenderer.tsx              # Thing sprite 渲染
├── RoomOverlay.tsx                # 房间叠加颜色层
└── Editor/
    ├── MapEditorPage.tsx          # 编辑器页面
    ├── Toolbar.tsx                # 工具栏
    ├── EditorPalette.tsx          # 实体调色板
    ├── ThingPlacer.tsx            # 实体放置工具
    ├── PaintTool.tsx              # 房间画笔
    └── EditorTypes.ts             # 编辑器类型
```

### 7.10 DB 持久化

```sql
-- 家居地图（每患者一条）
home_maps (
  id UUID PK,
  patient_id UUID FK UNIQUE,
  template_id VARCHAR,
  tiles JSONB NOT NULL,               -- Tile[][]
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- 地图上的 Thing
home_things (
  id UUID PK,
  map_id UUID FK,
  type VARCHAR NOT NULL,               -- wall, door, bed...
  tile_x INTEGER NOT NULL,
  tile_y INTEGER NOT NULL,
  tile_w INTEGER DEFAULT 1,
  tile_h INTEGER DEFAULT 1,
  rotation INTEGER DEFAULT 0,
  config JSONB,                        -- door status, home/away 等运行时状态
  pin_code VARCHAR(6),                  -- 关联 PIN（可选）
  FOREIGN KEY (pin_code) REFERENCES users_pin(pin) ON DELETE SET NULL
)

-- 用户上传的素材（含默认 NBT tags）
user_assets (
  id UUID PK,
  name VARCHAR NOT NULL,
  category VARCHAR NOT NULL,           -- structure/device/furnishing
  tile_w INTEGER DEFAULT 1,
  tile_h INTEGER DEFAULT 1,
  sprite_url VARCHAR NOT NULL,
  fallback_color VARCHAR,
  default_tags JSONB NOT NULL DEFAULT '{}',  -- NBT 默认标签
  author_id UUID FK REFERENCES users,
  uploaded_at TIMESTAMPTZ
)

-- home_things 的 config 字段即为 NBT tags 的持久化存储
```

相比之前的设计从 6 张表减为 **3 张表**，且不再需要 wall/room/door/window 的独立实体。

### 7.11 迁移路径

| 步 | 内容 | 文件 |
|----|------|------|
| 1 | `home-map/types.ts` — Tile, Thing, DetectedRoom, SpriteDef | 共享类型 |
| 2 | `home-map/tiles/` — grid.ts + roomDetection.ts（含测试） | 核心引擎 |
| 3 | `home-map/things/` — registry（15+ 内置 Thing）、wallConnector、doorLogic | Thing 系统 |
| 4 | `home-map/templates/` — 4 种户型模板 + factory | 模板 |
| 5 | `home-map/render/` — wallSprite/thingSprite/roomColors（2D Canvas 帮助函数） | 渲染逻辑 |
| 6 | `home-map/assets/` — builtin + custom sprite 类型 | 资产 |
| 7 | `home-map/behavior/` — room-stay/routine | 行为分析 |
| 8 | DB schema — maps + things + assets（3 表） | 持久化 |
| 9 | tRPC routers — 模板生成/Thing CRUD/地图保存 | API |
| 10 | `HomeMapView.tsx` + `ThingRenderer.tsx` + `RoomOverlay.tsx` | 前端 2D 视口 |
| 11 | Editor：PaintTool → WallTool → DoorTool → ObjectTool | 前端编辑器 |
| 12 | `AssetUploadDialog.tsx` — 上传 sprite + 定义能力 | 素材上传 |
| 13 | engine.ts + state.ts 之 WebSocket 广播 | 服务端 |
| 14 | 旧 `map/` 模块废弃 | 清理 |

---

## 8. 健康数据耦合设计

### 8.1 耦合全景

数字孪生系统与健康数据的耦合通过两条链路实现：

```
设备数据链路：
  Flutter/PIN → MQTT → mqtt-ingest/router → events 表
                              ↓ pin_code 关联
                           users_pin.thing_id → home_things → 房间
                              ↓ roomId → tile 坐标
                           前端 2D 地图渲染

健康记录链路：
  手动录入(Taro) → health_records 表
                              ↓ patientId
                           home_maps → 显示在哪个患者的家里
                              ↓
                           前端地图 + 趋势图表并排
```

### 8.2 Thing → Device 绑定（设备安装流程）

这是空间模型与健康数据耦合的**核心绑定点**。

```
安装流程（Flutter + Web 编辑器协作）：
┌─────────────────────────────────────────────────────────────────────┐
│ Flutter 运维端                         Web 编辑器端                 │
│                                                                     │
│ 1. 在 Flutter 输入 PIN                          放置 Thing          │
│    确认数据已到达 MQTT              { type: 'bed', tileX, tileY }  │
│                                    ↓                               │
│ 4. 关联：thing.pinCode = pin                                        │
│    明确"这张床 = PIN 1234 的数据"                                   │
└─────────────────────────────────────────────────────────────────────┘
```

```typescript
// 绑定后的数据结构
thing: {
  id: 'thing-001',
  type: 'bed',
  tileX: 5, tileY: 3,
  tileW: 2, tileH: 1,
  pinCode: '1234',                 // ← 关联 PIN，不再有 device
  tags: {
    sensors: ['heart_rate', 'respiratory_rate', 'bed_exit', 'motion'],
  }
}

// events 表通过 PIN 关联到空间位置
event: {
  pinCode: '1234',                 // MQTT topic 提取
  source: 'bed',                   // topic 中的 type
  metric: 'heart_rate',
  value: 72,
  tags: {
    // mqtt-ingest/router 注入：
    thingId: 'thing-001',
    thingType: 'bed',
    roomId: 'room-bedroom',
    roomType: 'bedroom',
  }
}
```

**MQTT→events 路由**（`mqtt-ingest/router.ts`）：

```typescript
// MQTT 消息格式: users/{pin}/{type}/{data}
// 收到消息 → 解析 topic → 查 PIN → 写入 events

async function onMessage(topic: string, payload: Buffer) {
  // topic = "users/1234/bed/data" 或 "users/1234/imu/motion"
  const parts = topic.split('/')
  if (parts[0] !== 'users' || parts.length < 4) return

  const pin = parts[1]
  const source = parts[2]            // 'bed' | 'imu' | etc
  const body = JSON.parse(payload.toString())

  // 查 PIN → 获取 userId + thingId
  const pinRecord = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
  if (!pinRecord.length) return      // 未知 PIN，丢弃

  const { user_id, thing_id } = pinRecord[0]

  // 查 thing → 获取 room（如果 thing_id 存在）
  let roomId: string | undefined
  if (thing_id) {
    const mapThings = await getMapThingsByThingId(thing_id)
    const runtime = roomLookupCache.getRuntimeByThingId(thing_id)
    roomId = runtime?.tileToRoomId.get(`${mapThings.tileX},${mapThings.tileY}`)
  }

  // 写入 events
  await db.insert(events).values({
    patientId: user_id,
    pinCode: pin,
    source,
    metric: body.metric,
    value: body.value,
    unit: body.unit,
    recordedAt: body.recordedAt ?? new Date().toISOString(),
    tags: { thingId: thing_id, roomId, thingTile: mapThings ? `${mapThings.tileX},${mapThings.tileY}` : undefined },
  })
}
```

### 8.3 固定设备 vs 移动设备

| 类型 | 示例 | 是否关联 thing | 是否锚定房间 | 事件 enrichment |
|------|------|---------------|-------------|----------------|
| 固定设备 | 床垫传感器、空调、门磁、烟雾报警器 | 是 | 是 | 注入 roomId/thingId |
| 固定传感器 | 温度传感器、人体感应灯 | 是 | 是 | 注入 roomId |
| 移动设备 | 血糖仪、体重秤、智能手表 | 否 | 否 | 无空间信息 |
| 手持录入 | Taro 小程序手动记录 | 否 | 否 | 用户可选标注"在厨房" |

对移动设备和手持录入，可在录入时由用户或系统推测标注房间：

```
Taro 录入血糖 → 根据时间段推测房间：
  - 空腹早晨 → 推测：厨房/餐厅
  - 餐后 → 推测：餐厅/客厅
  - 睡前 → 推测：卧室
  → 用户可修正：将本次记录标注到具体房间
```

### 8.4 健康数据在 2D 地图上的呈现

```
┌─────────────────────────────────────────────────┐
│  2D 家庭地图（主视口）                           │
│                                                  │
│  ┌──────卧室──────┐  ┌──────客厅──────┐          │
│  │ ❤️ 72 ██████   │  │ 🛋️ 久坐 2.3h   │          │
│  │   最近体征:    │  │ 🌡️ 26°C        │          │
│  │   心率 72      │  │                │          │
│  │   呼吸 16      │  │  🚨 昨夜跌倒   │          │
│  │   离床 2次     │  │   (已处理)     │          │
│  │                │  │                │          │
│  │  [🟢 在线]     │  │ [🟡 有人]      │          │
│  └──────┬───门────┘  └───────┬────────┘          │
│         │                    │                   │
│  ┌──────┴───门──┐  ┌───────┴──卫浴──┐          │
│  │   🚪 外出中   │  │ 🚿 今早使用    │          │
│  │   (门磁告警)  │  │ ⚠️ 地面积水    │          │
│  └──────玄关─────┘  └────────────────┘          │
└─────────────────────────────────────────────────┘
```

**前端数据聚合**：
- 每个房间从 `events` 表查询最近 N 分钟内的数据（通过 `events.tags.roomId`）
- 设备 Thing 显示最新读数（heart_rate 等）
- 房间叠加色表示健康状态（绿=正常 / 黄=注意 / 红=告警）
- 告警标记：按 roomId 归类的最近告警

### 8.5 位置感知告警规则

通过 `thing.roomId` 实现告警的**空间上下文**：

```typescript
// 告警规则引擎扩展——基于房间的规则
const locationAwareRules = [
  {
    // 卫生间跌倒 → 高优先级
    condition: (event) =>
      event.metric === 'fall_detected'
      && event.tags.roomType === 'bathroom',
    severity: 'critical',
    message: '卫生间跌倒！',
  },
  {
    // 半夜离床超过 30 分钟 → 家人通知
    condition: (event) =>
      event.metric === 'bed_exit'
      && event.tags.roomType === 'bedroom'
      && hourNow >= 0 && hourNow <= 5,
    severity: 'warning',
    message: '深夜离床，可能不适',
  },
  {
    // 厨房长时间无人且燃气开启 → 告警
    condition: (event) =>
      event.metric === 'gas_level'
      && event.value > 100
      && event.tags.roomType === 'kitchen',
    severity: 'critical',
    message: '燃气泄漏！',
  },
  {
    // 多日无厨房使用 → 看护告警
    condition: (aggregate) =>
      aggregate.type === 'daily'
      && aggregate.kitchen.sensorActivity === 0
      && aggregate.consecutiveDays >= 2,
    severity: 'warning',
    message: '已 {{days}} 天无厨房活动，请确认饮食状况',
  },
]
```

### 8.6 房间级健康分析

```typescript
interface RoomHealthInsight {
  roomId: string
  roomType: string

  // 停留统计
  stayDuration: number               // 今日停留分钟
  visits: number                     // 今日进入次数

  // 该房间内设备的体征（最近 24h）
  vitals: {
    metric: string
    latest: number
    avg24h: number
    min24h: number
    max24h: number
    abnormal: boolean
  }[]

  // 告警摘要
  alerts: {
    total: number
    critical: number
    unresolved: number
  }

  // 环境数据
  environment?: {
    avgTemperature: number
    avgHumidity?: number
  }

  // 健康提示（由聚合引擎生成）
  insight?: string
}

// 每日聚合（cron job）
function generateRoomHealthInsights(
  rooms: DetectedRoom[],
  things: Thing[],
  events: Event[]
): Map<string, RoomHealthInsight> {
  // 1. 按 roomId 分组 events
  // 2. 按 thingId 统计传感器数据
  // 3. 按 room 统计告警
  // 4. 生成简短健康提示
  // 例："卧室：昨夜离床 3 次，其中 1 次超过 30 分钟，可能存在睡眠中断。"
  // 例："卫生间：今日使用 5 次，均正常。"
  // 例："厨房：已 2 天无活动，请确认进食情况。"
}
```

### 8.7 行为-健康关联推断

将传感器事件 + 房间停留 + 健康记录三者关联，产生更有意义的推断：

```typescript
// 行为 + 健康 = 关联推断
function crossReferenceEvents(
  roomStays: RoomStay[],
  healthRecords: HealthRecord[],
  alerts: Alert[]
): HealthInsight[] {

  return [
    // 血糖 + 用餐房间 → 餐后血糖标记
    {
      type: 'glucose_context',
      when: healthRecord.type === 'blood_glucose'
            && roomStays.previousRoom === 'kitchen/dining',
      insight: '餐后血糖 {{value}} ({{minutes}}分钟前用餐)',
    },

    // 夜间离床次数 + 起夜频率 → 睡眠质量
    {
      type: 'sleep_quality',
      when: roomStays.bathroomVisits.night > 3,
      insight: '夜间起夜 {{count}} 次，建议关注前列腺/饮水习惯',
    },

    // 久坐 + 无 kitchen 活动 → 活动不足
    {
      type: 'low_activity',
      when: roomStays.livingroom.hours > 8
            && roomStays.kitchen.visits === 0,
      insight: '今日客厅久坐 {{hours}} 小时，未进入厨房，建议起身活动',
    },

    // 无卧室停留整夜 → 可能不在家/住院
    {
      type: 'absence',
      when: roomStays.bedroom.nightHours < 2,
      insight: '昨夜卧室无活动，用户可能外出或住院',
    },
  ]
}
```

### 8.8 仿真引擎与地图耦合

仿真引擎复用同一套地图+Thing 数据生成模拟数据：

```typescript
// 仿真 tick 逻辑（简化）：
function simulatePatientTick(
  patient: SimPatient,
  map: HomeMap,
  things: Thing[],
  rooms: DetectedRoom[]
): SimulatedEvent[] {

  // 1. 患者当前在某个房间
  const currentRoom = rooms.find(r => r.tiles.includes(`${patient.tileX},${patient.tileY}`))

  // 2. 根据当前时间 + 房间排程决定行为
  const behavior = schedule.lookup(hourNow, currentRoom.type)

  // 3. 如果需要移动到其他房间，用 tile 级 A* 规划路径
  if (behavior.targetRoom !== currentRoom.id) {
    const targetRoom = rooms.find(r => r.id === behavior.targetRoom)
    const doorTile = findDoorTile(currentRoom, targetRoom, things)
    patient.path = tileAStar(
      { x: patient.tileX, y: patient.tileY },
      doorTile,
      map.tiles,
      things
    )
  }

  // 4. 在当前位置生成健康事件
  //    当前房间中有 bed → 生成 heart_rate
  //    当前房间中有 sofa → 生成 seated_hours
  const roomThings = things.filter(t => currentRoom.tiles.includes(`${t.tileX},${t.tileY}`))
  const events = roomThings.flatMap(thing => {
    return (thing.tags.sensors as string[])?.map(metric => ({
      pinCode: thing.pinCode ?? 'simulated',
      source: 'simulator',
      metric,
      value: generateMetricValue(metric, behavior, patient.profile),
      tags: {
        roomId: currentRoom.id,
        roomType: currentRoom.type,
        thingId: thing.id,
      }
    })) ?? []
  })

  return events
}
```

### 8.9 数据流总结

```
               ┌──────────────────────────────────────────────┐
               │          数据入口                              │
               │  PIN→MQTT  │ Taro 手动录入                     │
               └──────┬─────┴──────────┬───────────────────────┘
                      │                │
                 users/1234/           │
                 bed/data              │
                      │                │
                 ┌────▼────┐     ┌─────▼──────────────┐
                 │ 查 PIN   │     │  health_records    │
                 │  → userId│     │  (血糖/体重/用药)   │
                 │  → thing │     │  source='manual'   │
                 │  → room  │     └────────────────────┘
                 └────┬────┘
                      │
                 ┌────▼──────────────────┐
                 │    events 表           │
                 │   pin_code, source    │
                 │   tags: { roomId,     │
                 │   thingId, roomType } │
                 └───────────┬───────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
          ┌─────▼────┐ ┌────▼────┐ ┌─────▼─────┐
          │ 房间分析  │ │ 告警引擎 │ │ 行为推断   │
          │ 停留统计  │ │位置感知  │ │ 健康关联   │
          │ 环境摘要  │ │前置处理  │ │ 跨引用    │
          └──────────┘ └─────────┘ └───────────┘
                │            │            │
                └────────────┼────────────┘
                             │
                    ┌─────────▼────────┐
                    │    前端呈现       │
                    │  2D 地图 + 体征   │
                    │  告警 + 分析      │
                    └──────────────────┘
```

### 8.10 实施要点

| 优先级 | 内容 | 前置依赖 |
|--------|------|---------|
| P0 | MQTT listener：订阅 users/+/+/+ → 查 PIN → 写入 events | PIN 表 |
| P0 | events 表 pin_code/source 字段迁移 | 无 |
| P1 | 前端地图叠加体征数据 | events 有 roomId |
| P1 | 位置感知告警规则引擎 | 告警系统 + roomId |
| P2 | 房间级健康分析 + 每日聚合 | events 数据积累 |
| P2 | 行为-健康关联推断 | 行为分析系统 |
| P2 | 仿真引擎复用地图数据 | 引擎 + 地图系统 |

---

## 9. 实施路线图

### 9.1 阶段总览

```
Phase          Time       Focus
──────────────────────────────────────────────────
Phase A       第 1-2 周   安全底座（见审查报告阶段 A）
Phase B       第 3-5 周   领域模型 + 健康记录
Phase C       第 5-8 周   前端重构 + 小程序
Phase D       第 8-12 周  数字孪生重设计 + Flutter
```

### 9.2 阶段优先级矩阵

```
                    紧迫性
                Low          High
        ┌──────────────────────────┐
必要性  │       Phase B        Phase A  │
   High │   领域模型强化      安全底座    │
        │                              │
        │       Phase D        Phase C  │
   Low  │   数字孪生重设计    前端+小程序  │
        └──────────────────────────┘
```

**执行顺序建议**：A → B 前期 → C → B 后期 → D

### 9.3 关键依赖关系

```
Phase A 无外部依赖，可立即启动

Phase B 依赖 Phase A 完成（安全底座是领域模型的前提）

Phase C 依赖 Phase B 的领域模型（新 schema 落地后才可重构前端）

Phase D 无外部依赖，与 B/C 并行进行

Phase B 内部顺序：
  1. 家庭模型（households + members）
  2. 患者模型扩展（home_id 等）
  3. 设备模型扩展（IoT 字段）
  4. 健康记录（血糖/体重 schema）
  5. 告警闭环状态机
```

### 9.4 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 数字孪生重构影响现有功能 | 高 | 演示受阻 | 保留新旧两套引擎并行运行，gate 控制切换 |
| Taro 小程序重构周期超预期 | 中 | 延期 | 先做新增页面，旧页面逐步替换 |
| 设备接入兼容性问题 | 中 | 数据采集不可用 | Flutter 端先做 MQTT+Bridge，BLE 延后 |
| 团队对图论抽象理解不足 | 中 | 质量下降 | 先写测试定义行为，再实现 |

---

## 10. IoT 接入 — PIN 码系统

### 10.1 核心原则

系统中**不存在"设备"概念**。PIN 码即是设备接口 —— 一个 PIN 代表一个逻辑数据源。

```
Flutter 终端 ──▶ 输入 PIN → 发数据到 users/{pin}/{type}/{data}
后端 ingest  ──▶ 解析 topic → 查 PIN → 注入 userId → 写入 events

一用户多 PIN：床垫传感器 PIN=1234，血糖仪 PIN=5678
系统不关心物理设备是什么型号、什么固件——只认 PIN
PIN 同时是认证凭证、路由标识、数据源标识
```

### 10.2 数据流

```
Flutter 启动 → 输入 PIN [1234]
  ↓ 本地保存，连接内置 MQTT（可覆盖地址用于测试）
  ↓ 向 users/1234/bed/data 发布 JSON

MQTT ──▶ users/+/+/+ 通配符
            ↓
       ingest 解析 topic：
         pin=1234, type=bed
            ↓
       users_pin 表：pin=1234 → userId+thingId
            ↓
       写入 events 表，注入 userId + roomId（通过 thingId 关联地图）
```

### 10.3 PIN 码表

```sql
-- PIN 是唯一的"设备"标识
users_pin (
  pin VARCHAR(6) PRIMARY KEY,         -- 4-6 位数字
  user_id UUID NOT NULL,              -- 所属用户
  label VARCHAR(64) DEFAULT '',       -- 管理端备注："张-主卧-床垫"
  nickname VARCHAR(32) DEFAULT '',    -- 用户端昵称："我的床垫"
  thing_id UUID,                      -- 关联地图上的 Thing（可选）
  room_id VARCHAR,                    -- 冗余缓存，避免每次查地图
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (thing_id) REFERENCES home_things(id) ON DELETE SET NULL
)

CREATE INDEX idx_users_pin_user_id ON users_pin(user_id);
```

### 10.4 一用户多 PIN 场景

| 用户 | PIN | 标签 | 关联 Thing | 用途 |
|------|-----|------|-----------|------|
| 张三 | 1234 | 主卧床垫 | bed@卧室 | 睡眠监测 |
| 张三 | 5678 | 客厅体重秤 | — | 体重记录 |
| 张三 | 9012 | 厨房血糖仪 | — | 血糖记录 |

非地图关联的 PIN（体重秤、血糖仪）没有 thingId，写入 events 时仅注入 userId。

### 10.5 PIN 管理（Web 端）

```
社区管理员可在 IoT 配置页：
├─ 查看所有 PIN（用户/标签/最后在线/关联房间）
├─ 生成新 PIN（分配给用户）
├─ 重置 PIN（原 PIN 失效）
├─ 删除 PIN（数据源作废）
```

### 10.6 与原有系统的关系

```
旧模型：Device(serialNumber, deviceType, firmware) → thing(binding) → events
新模型：PIN (唯一标识) ──→ thing(optional) ──→ events

移除：
- devices 表不再作为数据源入口（可读存档，不做运行时查询）
- device_type / firmware / manufacturer 等字段不再维护
- 不再需要设备注册/配对/固件升级流程

保留：
- home_things.deviceId 字段转为 pin_code（直接存 PIN 值）
- 前端的"设备管理"页面重构为"PIN 管理"页面
```

### 10.7 Flutter 终端流程

```
1. 打开应用 → PIN 输入界面（6 位数字键盘）
2. 输入 PIN → 本地存储
3. 连接 MQTT → 开始采集 → 向 users/{pin}/{type}/{data} 发布
4. 本地无需用户信息，PIN 是唯一凭证
```

### 10.8 与传统方案的对比

| | 传统 MQTT + 设备管理 | PIN 码系统 |
|--|---------------------|-----------|
| 设备注册 | 序列号→证书→激活 | 无——PIN 即设备 |
| 多设备 | 每设备独立凭证和注册 | 每用户多 PIN，管理简单 |
| 系统复杂度 | devices 表 + auth + provisioning | 一张 users_pin 表 |
| 固件/型号 | 需要维护 | 不关心 |
| 吊销 | 删除 device 记录 + 撤销证书 | 删除或重置 PIN |
| 用户识别 | 从 MQTT 用户名映射 | 从 topic 解析 PIN |

---

## 11. Taro 小程序 — 健康记录器设计方向

### 11.1 模块化架构

所有健康记录模块**平级**，统一表单外壳、统一交互风格：

```
健康记录模块（一期）:
├─ 血糖    → 血糖值 + 时段(空腹/餐后/睡前/随机) + 标签
├─ 血压    → 收缩压/舒张压/心率 三联输入
├─ 体重    → 体重 + 体脂率(可选) + BMI 自动计算
├─ 心率    → 数值 + 活动状态(静息/运动后/随机)
├─ 体温    → 数值
├─ 血氧    → 数值(SpO2)
├─ 用药    → 提醒确认 + 手动记录
├─ 疼痛    → VAS 滑动条 (0-10)
└─ 生理期  → 日期 + 流量 + 症状

EMA 动态表单（二期）:
├─ 后端 YAML 定义表单结构（6 种字段类型）
├─ 前端动态渲染通用表单，风格与固定模块一致
├─ cron 字段定义推送调度（每天早上 9 点推送）
└─ 科研项目专用，与健康采集独立
```

### 11.2 EMA 动态表单 — YAML 格式定义

#### 字段类型（共 6 种）

```
choice  — 单选（radio）
multi   — 多选（checkbox）
likert  — 李克特量表（1-N 级）
vas     — 视觉模拟量表（滑动条 0-100）
number  — 数字输入
text    — 文本输入
```

#### YAML 示例

```yaml
code: SLEEP_QUALITY
title: 睡眠质量追踪
cron: "0 9 * * *"              # 每天早上 9 点推送
fields:
  - id: sleep_hours
    type: number
    label: 昨晚睡了几个小时？
    min: 0
    max: 24

  - id: sleep_quality
    type: likert
    label: 整体睡眠质量
    labels: [很差, 较差, 一般, 较好, 很好]

  - id: wake_reason
    type: choice
    label: 醒来主要原因
    options:
      - { value: natural, label: 自然醒 }
      - { value: pain, label: 不适醒 }
      - { value: bathroom, label: 起夜 }
      - { value: noise, label: 被吵醒 }

  - id: symptoms
    type: multi
    label: 当前症状（可多选）
    options:
      - { value: headache, label: 头痛 }
      - { value: dizzy, label: 头晕 }
      - { value: palpitation, label: 心悸 }
      - { value: none, label: 无症状 }

  - id: pain_level
    type: vas
    label: 疼痛程度
    min_label: 无痛
    max_label: 剧痛

  - id: note
    type: text
    label: 补充说明
    placeholder: 可选
    rows: 3
```

#### Zod 验证器

**表单定义本身的 schema** — 校验 YAML 结构合法性：

```typescript
import { z } from 'zod'

const FormFieldSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1).max(64),
    label: z.string().min(1),
    required: z.boolean().default(true),
    type: z.literal('choice'),
    options: z.array(z.object({ value: z.string(), label: z.string() })).min(1),
  }),
  z.object({
    id: z.string().min(1).max(64),
    label: z.string().min(1),
    required: z.boolean().default(true),
    type: z.literal('multi'),
    options: z.array(z.object({ value: z.string(), label: z.string() })).min(1),
  }),
  z.object({
    id: z.string().min(1).max(64),
    label: z.string().min(1),
    required: z.boolean().default(true),
    type: z.literal('likert'),
    labels: z.array(z.string()).min(2).max(9),
  }),
  z.object({
    id: z.string().min(1).max(64),
    label: z.string().min(1),
    required: z.boolean().default(true),
    type: z.literal('vas'),
    min_label: z.string().optional(),
    max_label: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1).max(64),
    label: z.string().min(1),
    required: z.boolean().default(true),
    type: z.literal('number'),
    min: z.number().optional(),
    max: z.number().optional(),
    unit: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1).max(64),
    label: z.string().min(1),
    required: z.boolean().default(true),
    type: z.literal('text'),
    placeholder: z.string().optional(),
    rows: z.number().int().min(1).max(20).default(3),
  }),
])

export const FormYamlSchema = z.object({
  code: z.string().min(1).max(64),
  title: z.string().min(1),
  description: z.string().optional(),
  cron: z.string().regex(/^(\d{1,2} ){4}\d{1,2}$/, '格式: "分 时 日 月 周"').optional(),
  fields: z.array(FormFieldSchema).min(1).max(50),
})

export type FormDefinition = z.infer<typeof FormYamlSchema>
```

**运行态：YAML → 响应 Zod schema** — 确保提交数据符合定义：

```typescript
// 从解析后的 form 定义自动生成响应验证 schema
function buildResponseSchema(fields: FormFieldSchema[]): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of fields) {
    let field: z.ZodTypeAny
    switch (f.type) {
      case 'choice': field = z.string(); break
      case 'multi': field = z.array(z.string()); break
      case 'likert': field = z.number().int().min(0).max(f.labels.length - 1); break
      case 'vas': field = z.number().min(0).max(100); break
      case 'number': field = z.number(); break
      case 'text': field = z.string(); break
    }
    shape[f.id] = f.required ? field : field.nullable()
  }
  return z.object(shape)
}
```

**编写时有效性验证**：YAML 文件通过 `FormYamlSchema.parse(yaml)` 解析，不符合格式的在 CI/lint 阶段即报错，不等到运行时。

#### Cron 字段说明

`cron: "分 时 日 月 周"` — 5 位 cron 表达式，定义表单推送调度。

```
"0 9 * * *"     → 每天早上 9 点推送
"0 8,20 * * *"  → 每天早 8 点和晚 8 点
"0 9 * * 1,3,5" → 周一三五早上 9 点
"0 0 * * 0"     → 每周日午夜（生成周报类）
```

不设定 cron 的表单仅为"手动填写"，出现在表单列表中由用户自主选择。

### 11.3 设计约束

- 所有录入页面等高等宽，同一套表单外壳组件
- 数字键盘默认弹出，文本输入降级
- 单页录入、无需滚动、大号点击目标
- CSV 导出：任意时间范围、任意模块组合
- 内置趋势：最近 7 天迷你图 inline 显示
- 离线可用：本地存储，有网自动同步

---

## 附录：现有代码文件映射

```
apps/server/src/         → 后端服务（68 文件，~8.6k 行）
apps/web/src/            → Web 前端（25 文件，~3.2k 行）
packages/shared-types/   → 共享类型（20 文件，~1.3k 行）
apps/miniapp/            → Taro 小程序（重构目标）
apps/flutter/            → Flutter 工具（新增功能）
```
