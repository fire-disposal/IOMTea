# 健康计划 + 积分激励系统 — 设计方案

> 版本：v1.0
> 日期：2026-05-19
> 状态：初稿 / 待审阅

---

## 目录

1. [产品愿景](#1-产品愿景)
2. [核心概念与数据流](#2-核心概念与数据流)
3. [数据库设计](#3-数据库设计)
4. [后端 tRPC 接口](#4-后端-trpc-接口)
5. [积分计算引擎](#5-积分计算引擎)
6. [小程序前端设计](#6-小程序前端设计)
7. [动画与动效规范](#7-动画与动效规范)
8. [实施策略](#8-实施策略)

---

## 1. 产品愿景

### 1.1 目标

在小程序端引入**个性化健康计划**和**类游戏积分激励**机制，让用户：

- 自选追踪哪些健康指标（模块级定制）
- 每日获得清晰的任务卡片清单
- 每次记录完成获得积分反馈 — 类收集动画
- 连续记录获得递增连击奖励
- 积分成为用户"健康纪念"和后续奖励系统的基础

### 1.2 核心原则

| 原则 | 说明 |
|------|------|
| **模块平等** | 所有 8 种健康模块平等选择，无"必选核心/可选"之分 |
| **简单与深度并存** | 主流程勾选即用；要细节进齿轮二级设置 |
| **扩展性优先** | 数据和接口设计为奖励系统、成就系统留扩展 |
| **代码清晰** | 后端逻辑服务化分离，前端组件化，不污染既有代码 |
| **后端算分** | 所有积分计算逻辑在后端完成，前端仅展示和动画 |

### 1.3 用户端流程

```
制定计划 (选模块+提醒) → 每日自动生成清单卡片 → 记录 → 积分获取 → 连击激励
```

---

## 2. 核心概念与数据流

### 2.1 领域模型

```
User (1) ────── (1) Plan ────── (n) PlanItem
  │                                │
  │                                │ (cron/generation)
  │                                ▼
  │                          DailyChecklist
  │                                │
  │ (credit balance)               │ (completion triggers)
  ▼                                ▼
Streak ◄──── credit calc ──── CreditTransaction
```

- **Plan**：一个用户一个生效计划（`isActive = true`）
- **PlanItem**：计划中的单个健康模块 + 提醒/频次配置
- **DailyChecklist**：每日自动生成的待完成任务卡片
- **Streak**：每用户每模块的连续记录天数追踪
- **CreditTransaction**：积分流水，审计不可变

### 2.2 数据流

```
[小程序记录] → sync (healthRecords.batchCreate)
  → 标记 checklist.done
  → 计算 streak (currentStreak +/-)
  → 按 streak 查倍率 → 计算 credit
  → 插入 credit_transaction
  → UPDATE users.credit
  → 返回 { syncedIds, earnedCredits }
```

### 2.3 清单生成策略

DailyChecklist 按天惰性生成（查询时若无则创建）：

```
GET /checklist/today?userId=X
  若今日无记录 → 从 active plan 生成 checklist rows → 返回
  若已有 → 直接返回（附当前状态）
```

---

## 3. 数据库设计

### 3.1 枚举新增 (`schema/enums.ts`)

```ts
export const checklistStatusEnum = pgEnum('checklist_status', [
  'pending',
  'done',
  'skipped',
])

export const transactionTypeEnum = pgEnum('transaction_type', [
  'earn',   // 记录获得
  'spend',  // 未来消费
  'adjust', // 管理员调整
])
```

### 3.2 用户表追加字段 (`schema.ts`)

在 `users` 表定义中追加：

```ts
credit: integer('credit').default(0).notNull(),
```

### 3.3 新建 schema 文件 (`schema/plan.ts`)

```ts
import { integer, jsonb, pgTable, uniqueIndex, uuid, varchar, date, timestamp, text } from 'drizzle-orm/pg-core'
import { checklistStatusEnum, transactionTypeEnum } from './enums'
import { users, events } from '../schema'

// ── 计划 ──
export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).default('我的健康计划').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── 计划项 ──
export const planItems = pgTable(
  'plan_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
    moduleKey: varchar('module_key', { length: 50 }).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    reminderEnabled: boolean('reminder_enabled').default(false).notNull(),
    reminderTimes: jsonb('reminder_times').default('[]').notNull(),   // [{hour:8,min:0},{hour:18,min:30}]
    frequency: varchar('frequency', { length: 20 }).default('daily').notNull(), // 'daily' | 'multiple'
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex('plan_items_unique').on(t.planId, t.moduleKey),
  }),
)

// ── 每日清单 ──
export const dailyChecklists = pgTable(
  'daily_checklists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    date: date('date').notNull(),
    moduleKey: varchar('module_key', { length: 50 }).notNull(),
    status: checklistStatusEnum('status').default('pending').notNull(),
    planItemId: uuid('plan_item_id').references(() => planItems.id, { onDelete: 'set null' }),
    recordId: uuid('record_id').references(() => events.id, { onDelete: 'set null' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex('daily_checklist_unique').on(t.userId, t.date, t.moduleKey),
  }),
)

// ── 连胜记录 ──
export const streaks = pgTable(
  'streaks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    moduleKey: varchar('module_key', { length: 50 }).notNull(),
    currentStreak: integer('current_streak').default(0).notNull(),
    longestStreak: integer('longest_streak').default(0).notNull(),
    lastRecordDate: date('last_record_date'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex('streaks_unique').on(t.userId, t.moduleKey),
  }),
)

// ── 积分流水 ──
export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: integer('amount').notNull(),
  moduleKey: varchar('module_key', { length: 50 }),
  streakDay: integer('streak_day'),
  type: transactionTypeEnum('type').default('earn').notNull(),
  source: varchar('source', { length: 100 }).default('record').notNull(),
  checklistId: uuid('checklist_id').references(() => dailyChecklists.id, { onDelete: 'set null' }),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

### 3.4 DB 导出更新 (`db/index.ts`)

```ts
export * from './schema/plan'
```

---

## 4. 后端 tRPC 接口

### 4.1 计划管理 (`routers/plan.ts`)

```
plan.get     → query    → 获取当前用户生效计划完整树（plan + planItems）
plan.upsert  → mutation → 创建或更新计划（upsert plan → 增量同步 planItems）
plan.detail  → query    → 按 planId 获取详情 + items
```

**upsert 逻辑**：`input: { name?, items: Array<{moduleKey, enabled, reminderEnabled, reminderTimes, frequency}> }`
- 查找用户 isActive plan → 没有则创建
- items 按 moduleKey merge（有则 update，无则 insert，输入列表中不存在的 soft-disable）
- 返回完整 plan 树

### 4.2 每日清单 (`routers/checklist.ts`)

```
checklist.today  → query    → 获取今日清单（按需生成）
checklist.skip   → mutation → 跳过某任务卡（标记 skipped）
```

**today 逻辑**：
1. 查用户今日 dailyChecklists
2. 若无 → 从 active plan 启用的 items 生成今日行（status=pending）
3. 若有 → 直接返回
4. 返回格式包含模块名称、状态、提醒时间

### 4.3 积分系统 (`routers/credit.ts`)

```
credit.balance      → query    → { balance: number }
credit.transactions → query    → 分页流水 (page, pageSize, type?)
```

### 4.4 连胜状态 (`routers/streak.ts`)

```
streaks.status → query → 所有模块连胜状态列表
```

返回格式：
```ts
Array<{ moduleKey, currentStreak, longestStreak, lastRecordDate }>
```

### 4.5 积分注入同步流程（改造 `health-records.ts`）

在 `batchCreate` mutation 中，成功写入 events 后：

1. **更新 checklist** — 按 `(userId, date, moduleKey)` 查 dailyChecklist → update status=done
2. **更新 streak** — 查 streaks 表，按规则计算 currentStreak（见第5节）
3. **计算 credit** — 按 streak 天数查倍率表（见第5节）
4. **写入 transaction** — credit_transactions 插入
5. **更新余额** — users.credit += earned
6. **返回扩展** — `{ syncedIds, earnedCredits: Array<{moduleKey, amount, streakDay}> }`

改造后的返回类型：
```ts
{ syncedIds: string[], earnedCredits: { moduleKey: string, amount: number, streakDay: number }[] }
```

### 4.6 Router 注册 (`_app.ts`)

```ts
import { planRouter } from './plan'
import { checklistRouter } from './checklist'
import { creditRouter } from './credit'
import { streakRouter } from './streak'
```

---

## 5. 积分计算引擎

### 5.1 服务文件 (`services/credit-calculator.ts`)

```ts
// 连击倍率表 — 可调参
const STREAK_MULTIPLIER: Array<{ days: number; multiplier: number }> = [
  { days: 1,  multiplier: 1.0 },
  { days: 3,  multiplier: 1.2 },
  { days: 5,  multiplier: 1.5 },
  { days: 7,  multiplier: 2.0 },
  { days: 10, multiplier: 3.0 },
]

// 单次基础分值
const BASE_CREDIT = 10

/**
 * 根据当前连胜天数计算应得积分
 */
export function calculateCredit(streakDay: number): number {
  let multiplier = 1.0
  for (const tier of STREAK_MULTIPLIER) {
    if (streakDay >= tier.days) multiplier = tier.multiplier
  }
  return Math.round(BASE_CREDIT * multiplier)
}

/**
 * 根据 lastRecordDate 和当前日期计算新连胜天数
 */
export function calcNewStreak(lastRecordDate: Date | null, today: Date): number {
  if (!lastRecordDate) return 1
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (lastRecordDate.toDateString() === yesterday.toDateString()) {
    // 连续 → 从 streak 表 currentStreak + 1
    return -1 // 信号：由调用方从 streak 表读取后 +1
  }
  if (lastRecordDate.toDateString() === today.toDateString()) {
    return 0 // 同日重复记录，不增加 streak
  }
  return 1 // 断签→重置
}
```

### 5.2 指标与事件映射（复用现有）

复用 `health-records.ts` 中已有的 `mapRecordToEvents()` 做 moduleKey 映射。

---

## 6. 小程序前端设计

### 6.1 页面级改造

#### 首页 `pages/index/index.tsx`

移除现有 greeting / date 行，改为：

```
┌─ TopBar ────────────────────────┐
│ [头像] 张三            🪙 280   │
├─ Checklist Cards ──────────────┤
│ ▎🩸 血糖            ✓ +12     │  done (半透明)
│ ▌❤️ 血压            ○         │  pending (空心圈)
│ ▌💊 用药            ○         │  pending
│ ▌⚖️ 体重            ○         │  pending
├─ Quick Actions ────────────────┤
│ [📋 管理计划]  [📊 历史记录]   │
└────────────────────────────────┘
```

**组件树：**

```
<IndexPage>
  <TopBar avatar displayName credit />         ← 新建
  <ScrollView>
    <ChecklistCard moduleKey data status />    ← 新建×n，anim-stagger
  </ScrollView>
  <QuickActions />                             ← 重构
  <CreditAnimation />                          ← 新建（浮层）
  <TabBar current='index' />
</IndexPage>
```

**数据获取**：useEffect 中调 `checklist.today` 获取卡片列表，`credit.balance` 获取积分。本地缓存在 Taro storage。

#### 计划制定页 `pages/plan/index.tsx`（新增）

```
┌──────────────────────────┐
│ ← 返回    我的健康计划    │
├──────────────────────────┤
│ ☑ 血糖              ⚙   │   ← NutUI Cell + Checkbox + icon
│ ☑ 血压              ⚙   │
│ ☐ 心率              ⚙   │
│ ... 8 modules ...         │
├──────────────────────────┤
│        [保存计划]         │
└──────────────────────────┘
```

点击齿轮 → `pages/plan/detail/index?moduleKey=blood_glucose`

#### 计划详情页 `pages/plan/detail/index.tsx`（新增）

```
┌──────────────────────────┐
│ ← 返回   血糖·提醒设置    │
├──────────────────────────┤
│ 提醒时段                   │
│ ☑ 早晨   [TimePicker]    │   ← NutUI DatetimePicker
│ ☑ 中午   [TimePicker]    │
│ ☐ 晚上   --              │
│ ☐ 睡前   --              │
│                           │
│ 记录频次                   │
│ ● 每日一次                │   ← NutUI Radio
│ ○ 每日多次                │
├──────────────────────────┤
│          [保存]           │
└──────────────────────────┘
```

#### 我的页面改造 `pages/profile/index.tsx`

在用户信息区下方新增积分卡片：

```
┌────────────────────────┐
│    🪙 280 credits      │  ← CreditIcon 统一素材
│    连续记录 7 天         │  ← 最长连胜模块摘要
│    ━━━━━━━━━━━━━━━━━   │
│    查看积分明细  >       │  ← 跳转 credit 流水页
└────────────────────────┘
```

#### 积分明细页 `pages/credit/index.tsx`（新增）

简单分页列表，每条显示：日期、来源模块、积分变化、类型标签。

### 6.2 新增组件

| 组件 | 用途 | 依赖 |
|------|------|------|
| `CreditIcon` | 统一积分图标，全局一处引用 | 静态 assets/credit-icon.svg |
| `TopBar` | 首页顶栏：头像 + 用户名 + 积分 | CreditIcon, NutUI Avatar |
| `ChecklistCard` | 任务卡片：pending/done/skipped 三态 | NutUI Cell, CSS anim |
| `CreditAnimation` | 积分收集动效浮层 | CSS @keyframes |
| `StreakBadge` | 连胜天数徽章（SVG 环形） | inline SVG |

### 6.3 CreditIcon 统一素材策略

```tsx
// src/components/CreditIcon/index.tsx
import creditIcon from '@/assets/credit-icon.svg'

export function CreditIcon({ size = 20 }: { size?: number }) {
  return <Image src={creditIcon} style={{ width: size, height: size }} />
}
```

全局所有积分显示处引用 `<CreditIcon />`，后续换美术只需替换 `credit-icon.svg` 一个文件。

### 6.4 App 页面注册 (`app.config.ts`)

新增：
```
'pages/plan/index',
'pages/plan/detail/index',
'pages/credit/index',
```

---

## 7. 动画与动效规范

### 7.1 主题文件扩建 (`theme.scss`)

新增动效关键帧：

```scss
// 积分收集：卡片中弹出 → 飞向目标
@keyframes creditFloat {
  0%   { opacity: 1; transform: scale(0.5) translateY(0); }
  30%  { opacity: 1; transform: scale(1.2) translateY(-20px); }
  100% { opacity: 0; transform: scale(0.8) translateY(-60px); }
}

// 卡片完成态翻转（微妙的确认感）
@keyframes cardDone {
  0%   { transform: scale(1); background: #fff; }
  50%  { transform: scale(0.97); }
  100% { transform: scale(1); opacity: 0.72; }
}

// 积分余额数字跳动（ease-out 数字递增）
@keyframes balanceBump {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.15); }
}

// 空心圈 → 实心勾选过渡
@keyframes checkPop {
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.3); }
  100% { transform: scale(1); opacity: 1; }
}

.anim-credit-float  { animation: creditFloat 0.6s ease-out forwards; }
.anim-card-done     { animation: cardDone 0.35s ease-out forwards; }
.anim-balance-bump  { animation: balanceBump 0.3s ease-out; }
.anim-check-pop     { animation: checkPop 0.3s ease-out forwards; }
```

### 7.2 ChecklistCard 状态动画

| 状态 | 视觉 | 交互 |
|------|------|------|
| **pending** | 左侧暖黄竖线 | 点击 → 跳转记录页 |
| **done** | 左侧绿色竖线 + ✓ + 半透明 | `anim-card-done` 自动播放 |
| **skipped** | 灰色无竖线 + — | 静态 |

### 7.3 CreditAnimation 流程

记录同步成功后：
1. 对应 ChecklistCard 播放 `anim-card-done`（300ms）
2. 卡片右上角 "+12" 数字出现，播放 `anim-credit-float`（600ms）
3. 同时 TopBar 积分余额播放 `anim-balance-bump`（300ms）
4. 余额数字以 ease-out 缓动从小变大

### 7.4 组件选用原则

- **NutUI 组件做壳**：Cell, Checkbox, Switch, Tag, Button, Avatar, DatetimePicker, Radio
- **CSS animation 做效**：所有动效基于 `theme.scss` 中定义的 @keyframes
- **避免 JS 动画**：不用 Taro.createAnimation()，保持性能
- **matchaGreen 一致性**：所有颜色变量从 `theme.scss` 复用，不硬编码

---

## 8. 实施策略

### 8.1 分阶段执行

| 阶段 | 内容 | 影响范围 |
|------|------|----------|
| **Phase 1: 数据底座** | DB 表 + tRPC routers (plan/checklist/credit/streak) | server |
| **Phase 2: 积分引擎** | credit-calculator 服务 + batchCreate 改造 | server |
| **Phase 3: 计划页** | pages/plan/* + TopBar + ChecklistCard | miniapp |
| **Phase 4: 清单页** | ChecklistCard 动效 + CreditAnimation | miniapp |
| **Phase 5: 积分页** | profile 改造 + credit 流水页 | miniapp |
| **Phase 6: 联调打磨** | 端到端流程 + 动画时序调优 | 全局 |

### 8.2 向后兼容

- `users.credit` 新增列，默认 0，不影响现有查询
- `healthRecords.batchCreate` 返回结构向后兼容（新增 `earnedCredits` 可选字段），前端按需使用
- 用户若未创建计划 → checklist 返回空数组，不影响当前记录流程
- 旧 tracking_config（`Taro.getStorageSync('tracking_config')`）可选择性迁移导入到 plan

### 8.3 存量代码优化点（顺手改）

| 文件 | 问题 | 优化 |
|------|------|------|
| `miniapp/src/utils/storage.ts` | 硬编码字符串 key，散落各处 `getStorageSync('tracking_config')` | 收敛至 `STORAGE_KEYS` 常量枚举 |
| `miniapp/src/pages/index/index.tsx` | greeting/date 逻辑冗余，与新设计冲突 | 直接替换，移除无用代码 |
| `miniapp/src/pages/health/index.tsx` | `ALL_MODULES` 数组在 3+ 文件中重复定义 | 提取至 `constants/modules.ts` 单例 |
| `shared-types/src/index.ts` | 缺少 health module 类型导出 | 新增 `HealthModuleKey` union type |
| `server/src/core/trpc/routers/health-records.ts` | 直接内联 SQL，无服务层 | 积分逻辑抽取到 `services/credit-calculator.ts` |

### 8.4 待定项（后续迭代）

- 奖励兑换系统（credit 消费）
- 成就/徽章系统
- 微信服务通知（定时提醒推送）
- Leaderboard / 社区排名
- 积分商店 UI
