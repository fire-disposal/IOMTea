# Phase 2：数据管道 + 健康记录器 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task.

**Goal:** 打通 PIN→MQTT→events 数据管道，构建 Taro 健康记录器，适配 Web 社区管理端。

**Architecture:** 三个子项目并行——A（PIN 数据管道，后端为主），B（Taro 健康记录器，前端为主），C（Web 社区管理，后端+前端）。

**Tech Stack:** TypeScript, Hono/tRPC, Drizzle ORM, Mosquitto/MQTT, Taro/React, Zod, Canvas 2D

---

## 总览

| 子项目 | 依赖 | 预估工时 | 文件数 |
|--------|------|---------|--------|
| A: PIN 数据管道 | 无（可独立启动） | 4-5 天 | ~15 |
| B: Taro 记录器 | 无（可独立启动） | 8-10 天 | ~40 |
| C: Web 社区管理 | 依赖 A | 4-5 天 | ~15 |
| D: EMA 动态表单 | 依赖 B 外壳 | 3-4 天 | ~10 |

执行顺序：**A+B 同时启动 → C 在 A 之后 → D 在 B 之后**

---

## 子项目 A：PIN 数据管道

### A1: users_pin 表 + tRPC

**Files:**
- Create: `apps/server/src/core/db/schema/pin.ts` — Drizzle schema
- Create: `apps/server/src/core/trpc/routers/pin.ts` — CRUD procedures
- Modify: `apps/server/src/core/trpc/routers/_app.ts` — register router
- Modify: `apps/server/src/core/db/schema/index.ts` — export

```typescript
// pin.ts schema
import { pgTable, varchar, uuid, timestamp, foreignKey } from 'drizzle-orm/pg-core'
import { users } from './base'  // or wherever users is

export const usersPin = pgTable('users_pin', {
  pin: varchar('pin', { length: 6 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 64 }).default(''),
  nickname: varchar('nickname', { length: 32 }).default(''),
  thingId: uuid('thing_id'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

**Procedures:** `list`, `create`, `update` (label/nickname/thingId), `reset` (generates new PIN), `delete`, `getByUser`.

### A2: MQTT Listener

**Files:**
- Create: `apps/server/src/mqtt-ingest/listener.ts`
- Create: `apps/server/src/mqtt-ingest/router.ts`
- Create: `apps/server/src/mqtt-ingest/index.ts`
- Modify: `apps/server/src/index.ts` — start listener on boot

```typescript
// listener.ts — connects to MQTT broker and subscribes
import mqtt from 'mqtt'
import { routeMessage } from './router'

const TOPIC = 'users/+/+/+'

export function startMqttListener(brokerUrl: string = process.env.MQTT_URL || 'mqtt://localhost:1883') {
  const client = mqtt.connect(brokerUrl)
  client.on('connect', () => {
    client.subscribe(TOPIC)
  })
  client.on('message', async (topic, payload) => {
    try {
      await routeMessage(topic, payload)
    } catch (err) {
      console.error('[MQTT] route error:', err)
    }
  })
  return client
}
```

```typescript
// router.ts — topic → PIN → events
import { db } from '../core/db'
import { usersPin } from '../core/db/schema/pin'
import { events } from '../core/db/schema/events'
import { eq } from 'drizzle-orm'
import { roomLookupCache } from '../core/services/room-lookup-cache'

// topic: users/{pin}/{source}/{suffix}
// payload: { metric, value, unit?, recordedAt? }
export async function routeMessage(topic: string, payload: Buffer) {
  const parts = topic.split('/')
  if (parts.length < 4 || parts[0] !== 'users') return

  const pin = parts[1]
  const source = parts[2]

  // Parse payload
  let body: any
  try { body = JSON.parse(payload.toString()) } catch { return }
  if (!body.metric || body.value === undefined) return

  // Lookup PIN
  const [pinRecord] = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
  if (!pinRecord) return  // unknown PIN, silently drop

  // Enrich with room info
  const tags: Record<string, unknown> = {}
  if (pinRecord.thingId) {
    tags.thingId = pinRecord.thingId
    const runtime = roomLookupCache.getRuntimeByPin(pin)
    if (runtime) {
      const thing = runtime.things.find(t => t.pinCode === pin)
      if (thing) {
        const roomId = runtime.tileToRoomId.get(`${thing.tileX},${thing.tileY}`)
        if (roomId) {
          tags.roomId = roomId
          const room = runtime.rooms.find(r => r.id === roomId)
          if (room) tags.roomType = room.type
        }
      }
    }
  }

  await db.insert(events).values({
    patientId: pinRecord.userId,
    pinCode: pin,
    source,
    metric: body.metric,
    value: String(body.value),
    unit: body.unit ?? '',
    tags,
    recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
  })
}
```

### A3: RoomLookupCache PIN 适配

**Files:**
- Modify: `apps/server/src/core/services/room-lookup-cache.ts` — add `getRuntimeByPin`

Add a `pin → thingId` reverse map so that MQTT routing can O(1) find the thing:

```typescript
export class RoomLookupCache {
  // ... existing fields ...
  private thingByPin = new Map<string, Thing>()

  rebuildAll(): void {
    // ... existing rebuild logic ...
    // Add: for each thing with pinCode, thingByPin.set(thing.pinCode, thing)
  }

  getRuntimeByPin(pin: string): HomeMapRuntime | undefined {
    const thing = this.thingByPin.get(pin)
    if (!thing) return undefined
    return this.runtimeByPatient.get(/* find patient by thing.mapId */)
  }
}
```

### A4: events 表迁移

**Files:**
- Modify: `apps/server/src/core/db/schema/events.ts` — add pin_code, source; deprecate device_id

Add migration:
```sql
ALTER TABLE events ADD COLUMN pin_code VARCHAR(6);
ALTER TABLE events ADD COLUMN source VARCHAR(32) DEFAULT '';
CREATE INDEX idx_events_pin_code ON events(pin_code);
```

### A5: Web PIN 管理页面

**Files:**
- Create: `apps/web/src/pages/PinManagementPage.tsx` — table of PINs
- Modify: `apps/web/src/App.tsx` — add route

Table columns: PIN, User, Label, Nickname, Thing (linked room), Last Seen, Actions

Actions: Generate (for user), Edit (label/nickname), Reset (new PIN), Delete

---

## 子项目 B：Taro 健康记录器

### B1: 项目脚手架 + 统一表单外壳

**Files:**
- Create: `apps/miniapp/src/components/FormShell/FormShell.tsx`
- Create: `apps/miniapp/src/components/FormShell/NumberInput.tsx`
- Create: `apps/miniapp/src/components/FormShell/SegmentPicker.tsx`
- Create: `apps/miniapp/src/components/FormShell/SubmitButton.tsx`

统一定制：

```tsx
// FormShell.tsx — 每个录入页面的统一外壳
interface FormShellProps {
  title: string       // "记录血糖"
  unit: string        // "mmol/L"
  children: ReactNode
  onSave: () => void
  saving?: boolean
  recentTrend?: { date: string; value: number }[]  // 最近 7 天迷你图
}

// NumberInput.tsx — 数字键盘输入（大号字体、无闪烁光标）
interface NumberInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  decimal?: boolean   // 是否允许小数点
}
```

### B2: 血糖模块

**Files:**
- Create: `apps/miniapp/src/pages/record/glucose/index.tsx`
- Create: `apps/miniapp/src/pages/record/glucose/trend.tsx`
- Create: `apps/miniapp/src/pages/record/glucose/goal.tsx`

**Schema:**
```typescript
const glucoseSchema = z.object({
  value_mgdl: z.number().min(20).max(600),
  context: z.enum(['fasting', 'postprandial', 'bedtime', 'random']),
  meal_tag: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullable(),
  medication_before: z.boolean().default(false),
  medication_after: z.boolean().default(false),
  symptoms: z.array(z.string()).nullable(),
})
```

### B3: 血压模块

**Files:**
- Create: `apps/miniapp/src/pages/record/pressure/index.tsx`

三联输入布局：
```
┌──────┐  ┌──────┐  ┌──────┐
│ 收缩压 │  │ 舒张压 │  │ 心率  │
│ 120   │  │ 80    │  │ 72   │
│ mmHg  │  │ mmHg  │  │ bpm  │
└──────┘  └──────┘  └──────┘
```

### B4-B9: 体重 / 心率 / 体温 / 血氧 / 用药 / 生理期

每个模块一个独立页面目录，统一 `index.tsx` + `trend.tsx`（迷你趋势）。用药模块需要服药计划列表 + 一键确认。

### B10: 本地存储 + 离线同步

**Files:**
- Create: `apps/miniapp/src/utils/storage.ts`
- Create: `apps/miniapp/src/utils/sync.ts`

使用 Taro 的 `@tarojs/taro` 的 `setStorageSync` / `getStorageSync` 实现离线队列。有网时批量提交到 `health_records` 对应 tRPC endpoint。

### B11: CSV 导出

**Files:**
- Create: `apps/miniapp/src/pages/export/index.tsx`

时间范围选择器 + 模块勾选 → 生成 CSV → 使用 Taro `FileSystemManager` 写入临时文件分享。

### B12: 内置趋势图

使用 Canvas 2D 绘制迷你折线图（非重库，纯 Canvas 手写），显示在录入页面的表单下方作为即时反馈。

### B13: EMA 动态表单渲染器（二期核心）

**Files:**
- Create: `apps/miniapp/src/components/DynamicForm/DynamicForm.tsx`
- Create: `apps/miniapp/src/components/DynamicForm/fields/ChoiceField.tsx`
- Create: `apps/miniapp/src/components/DynamicForm/fields/MultiField.tsx`
- Create: `apps/miniapp/src/components/DynamicForm/fields/LikertField.tsx`
- Create: `apps/miniapp/src/components/DynamicForm/fields/VasField.tsx`
- Create: `apps/miniapp/src/components/DynamicForm/fields/NumberField.tsx`
- Create: `apps/miniapp/src/components/DynamicForm/fields/TextField.tsx`
- Create: `apps/miniapp/src/components/DynamicForm/FormRenderer.tsx`
- Create: `apps/server/src/core/services/form-yaml.ts` — YAML → Zod 解析服务
- Create: `apps/server/src/core/trpc/routers/dynamic-form.ts` — 表单 CRUD + 提交
- Create: `apps/server/data/forms/sleep-quality.yml` — 示例 YAML
- Create: `apps/server/data/forms/daily-mood.yml` — 示例 YAML

从 YAML 文件到前端渲染的完整链路：

```
YAML 文件（data/forms/*.yml）
  → FormYamlSchema.parse() 校验结构
  → DB storage
  → tRPC endpoint
  → Taro DynamicForm 组件渲染
  → 用户填写 → 提交 → Zod 二次校验 → events 表
```

---

## 子项目 C：Web 社区管理适配

### C1: Web 导航重构

替换 App.tsx 中的导航为社区管理结构：

```
📊 工作台
├─ 管辖总人数 / 今日告警 / 待随访 / 设备离线
├─ 异常患者卡片
└─ 最近告警摘要

👥 居民管理
├─ 按家庭分组
├─ 搜索/筛选
└─ 展开成员详情

📈 健康趋势
├─ 选患者 → 全部指标
├─ 趋势图 + 达标率
└─ CSV 导出

⚠️ 异常处置
├─ 待指派 / 处理中 / 已处置 三栏
├─ 指派 → 处置记录 → 关闭
└─ 历史复盘

📋 随访管理
├─ 今日/本周计划
├─ 随访记录
└─ 模板管理

💊 用药监督
├─ 管辖用药总览
└─ 依从性报表

📡 IoT 配置
├─ PIN 列表/生成/重置/删除
├─ PIN ↔ Thing 关联
└─ 数据流状态

⚙️ 系统设置
```

### C2: 告警三态工作流

弃用当前的 only `acknowledge/resolve`，改为 `assign → handle → close`：

```typescript
// alert status: new | assigned | handled | closed
// alert procedures:
alert.assign(input: { alertId, assigneeId })
alert.handle(input: { alertId, note })
alert.close(input: { alertId, resolution })
```

---

## 3. 实施顺序

```
Week 1-2: A1 + A2 + A4 (PIN 表 + MQTT listener + events 迁移)
          B1 + B2 + B3 (表单外壳 + 血糖 + 血压)
          并行进行

Week 2-3: A3 + A5 (RoomCache PIN 版 + Web PIN 管理)
          B4-B7 (体重/心率/体温/血氧)
          C1 (Web 导航重构)
          并行进行

Week 3-4: B8-B10 (用药/生理期/离线同步)
          C2 (告警三态工作流)
          并行进行

Week 4-5: B11-B12 (CSV 导出 + 趋势图)
          B13 (EMA 动态表单) — 可独立延后
          并行进行
```
