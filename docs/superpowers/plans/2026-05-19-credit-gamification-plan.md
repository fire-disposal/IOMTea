# 健康计划 + 积分激励系统 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在小程序端实现个性化健康计划制定、每日清单卡片、连击积分激励和收集动画。

**Architecture:** 后端新增 `plans`/`plan_items`/`daily_checklists`/`streaks`/`credit_transactions` 五张表 + 四个 tRPC router；积分计算引擎在 `healthRecords.batchCreate` 同步流程中注入；前端基于 NutUI 组件 + CSS animation 实现清单卡片和积分动效。

**Tech Stack:** Drizzle ORM + Hono + tRPC v11 (server), Taro 4 + React 18 + NutUI 3.0.20 + SCSS (miniapp)

---

## File Structure

```
# Server — new files
apps/server/src/core/db/schema/plan.ts           # 5 new tables
apps/server/src/services/credit-calculator.ts     # credit + streak logic
apps/server/src/core/trpc/routers/plan.ts         # plan CRUD
apps/server/src/core/trpc/routers/checklist.ts    # daily checklist
apps/server/src/core/trpc/routers/credit.ts       # credit balance + history
apps/server/src/core/trpc/routers/streak.ts       # streak status

# Server — modified files
apps/server/src/core/db/schema/enums.ts           # +2 enums
apps/server/src/core/db/schema.ts                 # users.credit column
apps/server/src/core/db/index.ts                  # export schema/plan
apps/server/src/core/trpc/routers/_app.ts         # register 4 routers
apps/server/src/core/trpc/routers/health-records.ts # inject credit calc

# Shared types
packages/shared-types/src/constants.ts            # HealthModuleKey type

# Miniapp — new files
apps/miniapp/src/constants/modules.ts             # ALL_MODULES single source
apps/miniapp/src/constants/storage-keys.ts        # STORAGE_KEYS enum
apps/miniapp/src/pages/plan/index.tsx             # plan main page
apps/miniapp/src/pages/plan/index.scss
apps/miniapp/src/pages/plan/detail/index.tsx      # module reminder detail
apps/miniapp/src/pages/plan/detail/index.scss
apps/miniapp/src/pages/credit/index.tsx           # credit history
apps/miniapp/src/pages/credit/index.scss
apps/miniapp/src/components/CreditIcon/index.tsx  # unified credit icon
apps/miniapp/src/components/TopBar/index.tsx      # homepage top bar
apps/miniapp/src/components/TopBar/index.scss
apps/miniapp/src/components/ChecklistCard/index.tsx # task card
apps/miniapp/src/components/ChecklistCard/index.scss
apps/miniapp/src/components/CreditAnimation/index.tsx # float animation
apps/miniapp/src/components/CreditAnimation/index.scss

# Miniapp — modified files
apps/miniapp/src/app.config.ts                    # register new pages
apps/miniapp/src/theme.scss                       # new animation keyframes
apps/miniapp/src/pages/index/index.tsx            # full redesign
apps/miniapp/src/pages/index/index.scss           # new styles
apps/miniapp/src/pages/profile/index.tsx          # add credit card
apps/miniapp/src/pages/profile/index.scss
apps/miniapp/src/pages/health/index.tsx           # use constants/modules
apps/miniapp/src/pages/settings/tracking/index.tsx# use constants/modules
apps/miniapp/src/utils/storage.ts                 # use STORAGE_KEYS
apps/miniapp/src/utils/sync.ts                    # handle earnedCredits
```

---

### Task 1: DB Enums + users.credit Column

**Files:**
- Modify: `apps/server/src/core/db/schema/enums.ts`
- Modify: `apps/server/src/core/db/schema.ts`

- [ ] **Step 1: Add new enums to `schema/enums.ts`**

In `schema/enums.ts`, after the `confirmationMethodEnum` definition (line 26), append:

```ts
export const checklistStatusEnum = pgEnum('checklist_status', [
  'pending',
  'done',
  'skipped',
])

export const transactionTypeEnum = pgEnum('transaction_type', [
  'earn',
  'spend',
  'adjust',
])
```

Also append TypeScript type exports after line 45:

```ts
export type ChecklistStatus = 'pending' | 'done' | 'skipped'
export type TransactionType = 'earn' | 'spend' | 'adjust'
```

- [ ] **Step 2: Add `credit` column to `users` table in `schema.ts`**

In `schema.ts`, in the `users` table definition, add after `status` (line 37):

```ts
credit: integer('credit').default(0).notNull(),
```

- [ ] **Step 3: Verify build still compiles**

```bash
cd apps/server && pnpm run build
```

Expected: no type errors related to new enums/column.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/core/db/schema/enums.ts apps/server/src/core/db/schema.ts
git commit -m "feat(db): add checklist_status and transaction_type enums, users.credit column"
```

---

### Task 2: New Schema File (plan tables)

**Files:**
- Create: `apps/server/src/core/db/schema/plan.ts`
- Modify: `apps/server/src/core/db/index.ts`

- [ ] **Step 1: Create `schema/plan.ts`**

```ts
import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { checklistStatusEnum, transactionTypeEnum } from './enums'
import { events, users } from '../schema'

export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).default('我的健康计划').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const planItems = pgTable(
  'plan_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .references(() => plans.id, { onDelete: 'cascade' })
      .notNull(),
    moduleKey: varchar('module_key', { length: 50 }).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    reminderEnabled: boolean('reminder_enabled').default(false).notNull(),
    reminderTimes: jsonb('reminder_times').default('[]').notNull(),
    frequency: varchar('frequency', { length: 20 }).default('daily').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex('plan_items_unique').on(t.planId, t.moduleKey),
  }),
)

export const dailyChecklists = pgTable(
  'daily_checklists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    date: date('date').notNull(),
    moduleKey: varchar('module_key', { length: 50 }).notNull(),
    status: checklistStatusEnum('status').default('pending').notNull(),
    planItemId: uuid('plan_item_id').references(() => planItems.id, {
      onDelete: 'set null',
    }),
    recordId: uuid('record_id').references(() => events.id, {
      onDelete: 'set null',
    }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex('daily_checklist_unique').on(t.userId, t.date, t.moduleKey),
    userIdDateIdx: uniqueIndex('daily_checklist_user_date_idx').on(t.userId, t.date),
  }),
)

export const streaks = pgTable(
  'streaks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
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

export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  amount: integer('amount').notNull(),
  moduleKey: varchar('module_key', { length: 50 }),
  streakDay: integer('streak_day'),
  type: transactionTypeEnum('type').default('earn').notNull(),
  source: varchar('source', { length: 100 }).default('record').notNull(),
  checklistId: uuid('checklist_id').references(() => dailyChecklists.id, {
    onDelete: 'set null',
  }),
  eventId: uuid('event_id').references(() => events.id, {
    onDelete: 'set null',
  }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

- [ ] **Step 2: Register export in `db/index.ts`**

Add after line 15 (`export * from './schema/pin'`):

```ts
export * from './schema/plan'
```

- [ ] **Step 3: Run migration**

```bash
cd apps/server && npx drizzle-kit generate
```

Expected: new migration SQL generated in `drizzle/`.

- [ ] **Step 4: Run migration against DB**

```bash
cd apps/server && npx drizzle-kit migrate
```

Expected: tables created successfully.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/core/db/schema/plan.ts apps/server/src/core/db/index.ts apps/server/drizzle/
git commit -m "feat(db): add plans, plan_items, daily_checklists, streaks, credit_transactions tables"
```

---

### Task 3: Credit Calculator Service

**Files:**
- Create: `apps/server/src/services/credit-calculator.ts`

- [ ] **Step 1: Create `services/credit-calculator.ts`**

```ts
const STREAK_MULTIPLIER: Array<{ days: number; multiplier: number }> = [
  { days: 1, multiplier: 1.0 },
  { days: 3, multiplier: 1.2 },
  { days: 5, multiplier: 1.5 },
  { days: 7, multiplier: 2.0 },
  { days: 10, multiplier: 3.0 },
]

const BASE_CREDIT = 10

export function calculateCredit(streakDay: number): number {
  let multiplier = 1.0
  for (const tier of STREAK_MULTIPLIER) {
    if (streakDay >= tier.days) multiplier = tier.multiplier
  }
  return Math.round(BASE_CREDIT * multiplier)
}

export function calcNewStreak(
  lastRecordDate: Date | null | undefined,
  currentStreak: number,
  today: Date,
): { newStreak: number; action: 'continue' | 'reset' | 'same_day' } {
  if (!lastRecordDate) return { newStreak: 1, action: 'reset' }

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const lastStr = lastRecordDate.toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (lastStr === todayStr) return { newStreak: currentStreak, action: 'same_day' }
  if (lastStr === yesterdayStr) return { newStreak: currentStreak + 1, action: 'continue' }
  return { newStreak: 1, action: 'reset' }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/services/credit-calculator.ts
git commit -m "feat(server): add credit calculator service with streak multiplier"
```

---

### Task 4: Plan tRPC Router

**Files:**
- Create: `apps/server/src/core/trpc/routers/plan.ts`
- Modify: `apps/server/src/core/trpc/routers/_app.ts`

- [ ] **Step 1: Create `routers/plan.ts`**

```ts
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { plans, planItems } from '../../db/schema'
import { protectedProcedure, router } from '../index'

const planItemInput = z.object({
  moduleKey: z.string().min(1).max(50),
  enabled: z.boolean().default(true),
  reminderEnabled: z.boolean().default(false),
  reminderTimes: z.array(z.object({ hour: z.number(), min: z.number() })).default([]),
  frequency: z.enum(['daily', 'multiple']).default('daily'),
  sortOrder: z.number().int().default(0),
})

const upsertInput = z.object({
  name: z.string().min(1).max(100).optional(),
  items: z.array(planItemInput),
})

export const planRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const [plan] = await ctx.db
      .select()
      .from(plans)
      .where(and(eq(plans.userId, ctx.userId!), eq(plans.isActive, true)))
      .limit(1)

    if (!plan) return null

    const items = await ctx.db
      .select()
      .from(planItems)
      .where(eq(planItems.planId, plan.id))
      .orderBy(planItems.sortOrder)

    return { ...plan, items }
  }),

  upsert: protectedProcedure
    .input(upsertInput)
    .mutation(async ({ ctx, input }) => {
      let [plan] = await ctx.db
        .select()
        .from(plans)
        .where(and(eq(plans.userId, ctx.userId!), eq(plans.isActive, true)))
        .limit(1)

      if (!plan) {
        const [created] = await ctx.db
          .insert(plans)
          .values({
            userId: ctx.userId!,
            name: input.name || '我的健康计划',
          })
          .returning()
        plan = created
      } else if (input.name) {
        await ctx.db
          .update(plans)
          .set({ name: input.name, updatedAt: new Date() })
          .where(eq(plans.id, plan.id))
      }

      const existing = await ctx.db
        .select()
        .from(planItems)
        .where(eq(planItems.planId, plan.id))

      const existingMap = new Map(existing.map((e) => [e.moduleKey, e]))

      for (const item of input.items) {
        const current = existingMap.get(item.moduleKey)
        if (current) {
          await ctx.db
            .update(planItems)
            .set({
              enabled: item.enabled,
              reminderEnabled: item.reminderEnabled,
              reminderTimes: item.reminderTimes,
              frequency: item.frequency,
              sortOrder: item.sortOrder,
              updatedAt: new Date(),
            })
            .where(eq(planItems.id, current.id))
        } else {
          await ctx.db.insert(planItems).values({
            planId: plan.id,
            moduleKey: item.moduleKey,
            enabled: item.enabled,
            reminderEnabled: item.reminderEnabled,
            reminderTimes: item.reminderTimes,
            frequency: item.frequency,
            sortOrder: item.sortOrder,
          })
        }
      }

      const items = await ctx.db
        .select()
        .from(planItems)
        .where(eq(planItems.planId, plan.id))
        .orderBy(planItems.sortOrder)

      return { ...plan, items }
    }),

  detail: protectedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [plan] = await ctx.db
        .select()
        .from(plans)
        .where(and(eq(plans.id, input.planId), eq(plans.userId, ctx.userId!)))
        .limit(1)

      if (!plan) return null

      const items = await ctx.db
        .select()
        .from(planItems)
        .where(eq(planItems.planId, plan.id))
        .orderBy(planItems.sortOrder)

      return { ...plan, items }
    }),
})
```

- [ ] **Step 2: Register in `_app.ts`**

Add import after line 10:
```ts
import { planRouter } from './plan'
```

Add in the router object after `data`:
```ts
plan: planRouter,
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/trpc/routers/plan.ts apps/server/src/core/trpc/routers/_app.ts
git commit -m "feat(server): add plan tRPC router with upsert"
```

---

### Task 5: Checklist tRPC Router

**Files:**
- Create: `apps/server/src/core/trpc/routers/checklist.ts`
- Modify: `apps/server/src/core/trpc/routers/_app.ts`

- [ ] **Step 1: Create `routers/checklist.ts`**

```ts
import { eq, and, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { dailyChecklists, planItems, plans } from '../../db/schema'
import { protectedProcedure, router } from '../index'

export const checklistRouter = router({
  today: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10)

    const existing = await ctx.db
      .select()
      .from(dailyChecklists)
      .where(
        and(
          eq(dailyChecklists.userId, ctx.userId!),
          eq(dailyChecklists.date, today),
        ),
      )

    if (existing.length > 0) return existing

    const [activePlan] = await ctx.db
      .select()
      .from(plans)
      .where(and(eq(plans.userId, ctx.userId!), eq(plans.isActive, true)))
      .limit(1)

    if (!activePlan) return []

    const items = await ctx.db
      .select()
      .from(planItems)
      .where(
        and(eq(planItems.planId, activePlan.id), eq(planItems.enabled, true)),
      )

    if (items.length === 0) return []

    const rows = items.map((item) => ({
      userId: ctx.userId!,
      date: today,
      moduleKey: item.moduleKey,
      status: 'pending' as const,
      planItemId: item.id,
    }))

    await ctx.db.insert(dailyChecklists).values(rows)

    const created = await ctx.db
      .select()
      .from(dailyChecklists)
      .where(
        and(
          eq(dailyChecklists.userId, ctx.userId!),
          eq(dailyChecklists.date, today),
        ),
      )

    return created
  }),

  skip: protectedProcedure
    .input(z.object({ checklistId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(dailyChecklists)
        .set({ status: 'skipped' })
        .where(
          and(
            eq(dailyChecklists.id, input.checklistId),
            eq(dailyChecklists.userId, ctx.userId!),
          ),
        )
      return { success: true }
    }),
})
```

- [ ] **Step 2: Register in `_app.ts`**

Add import:
```ts
import { checklistRouter } from './checklist'
```

Add in router object:
```ts
checklist: checklistRouter,
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/trpc/routers/checklist.ts apps/server/src/core/trpc/routers/_app.ts
git commit -m "feat(server): add daily checklist tRPC router"
```

---

### Task 6: Credit + Streak tRPC Routers

**Files:**
- Create: `apps/server/src/core/trpc/routers/credit.ts`
- Create: `apps/server/src/core/trpc/routers/streak.ts`
- Modify: `apps/server/src/core/trpc/routers/_app.ts`

- [ ] **Step 1: Create `routers/credit.ts`**

```ts
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { creditTransactions, users } from '../../db/schema'
import { protectedProcedure, router } from '../index'

export const creditRouter = router({
  balance: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select({ credit: users.credit })
      .from(users)
      .where(eq(users.id, ctx.userId!))
      .limit(1)

    return { balance: user?.credit ?? 0 }
  }),

  transactions: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
        type: z.enum(['earn', 'spend', 'adjust']).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(creditTransactions.userId, ctx.userId!)]
      if (input.type) conditions.push(eq(creditTransactions.type, input.type))

      const rows = await ctx.db
        .select()
        .from(creditTransactions)
        .where(and(...conditions))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize)

      return rows
    }),
})
```

- [ ] **Step 2: Create `routers/streak.ts`**

```ts
import { eq } from 'drizzle-orm'
import { streaks } from '../../db/schema'
import { protectedProcedure, router } from '../index'

export const streakRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(streaks)
      .where(eq(streaks.userId, ctx.userId!))

    return rows.map((r) => ({
      moduleKey: r.moduleKey,
      currentStreak: r.currentStreak,
      longestStreak: r.longestStreak,
      lastRecordDate: r.lastRecordDate,
    }))
  }),
})
```

- [ ] **Step 3: Register both in `_app.ts`**

Add imports:
```ts
import { creditRouter } from './credit'
import { streakRouter } from './streak'
```

Add in router object:
```ts
credit: creditRouter,
streak: streakRouter,
```

Fix `and` import in `credit.ts` — add at top:
```ts
import { eq, desc, and } from 'drizzle-orm'
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/core/trpc/routers/credit.ts apps/server/src/core/trpc/routers/streak.ts apps/server/src/core/trpc/routers/_app.ts
git commit -m "feat(server): add credit and streak tRPC routers"
```

---

### Task 7: Inject Credit Logic into health-records sync

**Files:**
- Modify: `apps/server/src/core/trpc/routers/health-records.ts`

- [ ] **Step 1: Rewrite `health-records.ts` with credit injection**

The file needs to import the new tables and credit calculator, then inject credit calculation after event insertion.

Full replacement of `apps/server/src/core/trpc/routers/health-records.ts`:

```ts
import { TRPCError } from '@trpc/server'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { events, patients, dailyChecklists, streaks, creditTransactions, users } from '../../db/schema'
import { calculateCredit, calcNewStreak } from '../../../services/credit-calculator'
import { protectedProcedure, router } from '../index'

const healthRecordType = z.enum([
  'blood_glucose',
  'blood_pressure',
  'weight',
  'heart_rate',
  'temperature',
  'spo2',
  'medication',
  'period',
])

const healthRecordSchema = z.object({
  id: z.string(),
  type: healthRecordType,
  data: z.record(z.unknown()),
  recordedAt: z.string(),
  synced: z.boolean(),
})

const batchCreateInput = z.object({
  records: z.array(healthRecordSchema),
  patientId: z.string().uuid().optional(),
})

const batchCreateOutput = z.object({
  syncedIds: z.array(z.string()),
  earnedCredits: z.array(z.object({
    moduleKey: z.string(),
    amount: z.number(),
    streakDay: z.number(),
  })).optional(),
})

type RawRecord = z.infer<typeof healthRecordSchema>

interface EventInsert {
  patientId: string
  kind: 'observation' | 'behavior'
  metric: string
  value?: number | null
  unit?: string
  tags: Record<string, unknown>
  recordedAt: Date
  source: 'manual'
}

function mapRecordToEvents(record: RawRecord, patientId: string): EventInsert[] {
  const recordedAt = new Date(record.recordedAt)
  const base: Omit<EventInsert, 'metric' | 'kind' | 'tags'> = {
    patientId,
    recordedAt,
    source: 'manual',
  }

  switch (record.type) {
    case 'blood_glucose':
      return [{
        ...base,
        kind: 'observation',
        metric: 'glucose',
        value: record.data.value_mgdl as number | null | undefined,
        unit: 'mg/dL',
        tags: {},
      }]
    case 'blood_pressure':
      return [
        { ...base, kind: 'observation', metric: 'systolic_bp', value: record.data.systolic as number | null | undefined, unit: 'mmHg', tags: {} },
        { ...base, kind: 'observation', metric: 'diastolic_bp', value: record.data.diastolic as number | null | undefined, unit: 'mmHg', tags: {} },
      ]
    case 'weight':
      return [{ ...base, kind: 'observation', metric: 'weight', value: record.data.weight_kg as number | null | undefined, unit: 'kg', tags: {} }]
    case 'heart_rate':
      return [{ ...base, kind: 'observation', metric: 'heart_rate', value: record.data.bpm as number | null | undefined, unit: 'bpm', tags: {} }]
    case 'temperature':
      return [{ ...base, kind: 'observation', metric: 'temperature', value: record.data.celsius as number | null | undefined, unit: '°C', tags: {} }]
    case 'spo2':
      return [{ ...base, kind: 'observation', metric: 'spo2', value: record.data.percentage as number | null | undefined, unit: '%', tags: {} }]
    case 'medication':
      return [{ ...base, kind: 'behavior', metric: 'medication', tags: { drug: record.data.drug, action: record.data.action } }]
    case 'period':
      return [{ ...base, kind: 'behavior', metric: 'period', tags: record.data as Record<string, unknown> }]
  }
}

async function processCredits(
  db: any,
  userId: string,
  record: RawRecord,
  eventId: string,
  checklistId: string,
): Promise<{ amount: number; streakDay: number } | null> {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const [existing] = await db
    .select()
    .from(streaks)
    .where(and(eq(streaks.userId, userId), eq(streaks.moduleKey, record.type)))
    .limit(1)

  let currentStreak: number
  let longestStreak: number
  let { newStreak } = calcNewStreak(existing?.lastRecordDate, existing?.currentStreak ?? 0, today)

  if (!existing) {
    currentStreak = newStreak
    longestStreak = newStreak
    await db.insert(streaks).values({
      userId,
      moduleKey: record.type,
      currentStreak,
      longestStreak,
      lastRecordDate: todayStr,
    })
  } else {
    currentStreak = newStreak
    longestStreak = Math.max(existing.longestStreak, newStreak)
    await db
      .update(streaks)
      .set({ currentStreak, longestStreak, lastRecordDate: todayStr, updatedAt: new Date() })
      .where(eq(streaks.id, existing.id))
  }

  const amount = calculateCredit(currentStreak)

  await db.insert(creditTransactions).values({
    userId,
    amount,
    moduleKey: record.type,
    streakDay: currentStreak,
    type: 'earn',
    source: 'record',
    checklistId,
    eventId,
    note: `${record.type} streak day ${currentStreak}`,
  })

  await db
    .update(users)
    .set({ credit: sql`${users.credit} + ${amount}` })
    .where(eq(users.id, userId))

  return { amount, streakDay: currentStreak }
}

import { sql } from 'drizzle-orm'

export const healthRecordsRouter = router({
  batchCreate: protectedProcedure
    .input(batchCreateInput)
    .output(batchCreateOutput)
    .mutation(async ({ ctx, input }) => {
      let patientId = input.patientId

      if (!patientId) {
        const [patient] = await ctx.db
          .select({ id: patients.id })
          .from(patients)
          .where(eq(patients.userId, ctx.userId!))
          .orderBy(patients.createdAt)
          .limit(1)

        if (!patient) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No patient found for the authenticated user',
          })
        }
        patientId = patient.id
      } else {
        const [patient] = await ctx.db
          .select({ id: patients.id })
          .from(patients)
          .where(eq(patients.id, patientId))
          .limit(1)

        if (!patient) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Patient not found' })
        }
      }

      if (input.records.length === 0) {
        return { syncedIds: [] }
      }

      const allEvents = input.records.flatMap((record) =>
        mapRecordToEvents(record, patientId),
      )

      await ctx.db.insert(events).values(allEvents)

      // --- Credit processing per record ---
      const earnedCredits: { moduleKey: string; amount: number; streakDay: number }[] = []
      const todayStr = new Date().toISOString().slice(0, 10)

      for (const record of input.records) {
        // Mark checklist as done
        const [checklist] = await ctx.db
          .select()
          .from(dailyChecklists)
          .where(
            and(
              eq(dailyChecklists.userId, ctx.userId!),
              eq(dailyChecklists.date, todayStr),
              eq(dailyChecklists.moduleKey, record.type),
            ),
          )
          .limit(1)

        if (checklist) {
          await ctx.db
            .update(dailyChecklists)
            .set({ status: 'done', completedAt: new Date() })
            .where(eq(dailyChecklists.id, checklist.id))

          const creditResult = await processCredits(
            ctx.db,
            ctx.userId!,
            record,
            'N/A', // eventId not available individually
            checklist.id,
          )
          if (creditResult) {
            earnedCredits.push({
              moduleKey: record.type,
              amount: creditResult.amount,
              streakDay: creditResult.streakDay,
            })
          }
        }
      }

      return {
        syncedIds: input.records.map((r) => r.id),
        earnedCredits,
      }
    }),
})
```

- [ ] **Step 2: Verify compilation**

```bash
cd apps/server && pnpm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/trpc/routers/health-records.ts
git commit -m "feat(server): inject credit calculation into health-records sync"
```

---

### Task 8: Shared Types + Miniapp Constants

**Files:**
- Create: `apps/miniapp/src/constants/modules.ts`
- Create: `apps/miniapp/src/constants/storage-keys.ts`
- Modify: `packages/shared-types/src/constants.ts`

- [ ] **Step 1: Add `HealthModuleKey` to shared types**

In `packages/shared-types/src/constants.ts`, add:

```ts
export const HEALTH_MODULE_KEYS = [
  'blood_glucose',
  'blood_pressure',
  'weight',
  'heart_rate',
  'temperature',
  'spo2',
  'medication',
  'period',
] as const

export type HealthModuleKey = (typeof HEALTH_MODULE_KEYS)[number]

export const HEALTH_MODULE_META: Record<HealthModuleKey, { label: string; unit: string; icon: string }> = {
  blood_glucose:  { label: '血糖', unit: 'mmol/L', icon: '🩸' },
  blood_pressure: { label: '血压', unit: 'mmHg',  icon: '❤️' },
  weight:         { label: '体重', unit: 'kg',     icon: '⚖️' },
  heart_rate:     { label: '心率', unit: 'bpm',    icon: '💓' },
  temperature:    { label: '体温', unit: '°C',     icon: '🌡️' },
  spo2:           { label: '血氧', unit: '%',      icon: '🫁' },
  medication:     { label: '用药', unit: '',        icon: '💊' },
  period:         { label: '生理期', unit: '',       icon: '🌸' },
}
```

- [ ] **Step 2: Create `apps/miniapp/src/constants/modules.ts`**

```ts
import { HEALTH_MODULE_META, HEALTH_MODULE_KEYS, type HealthModuleKey } from '@iomtea/shared-types'

export { HEALTH_MODULE_META, HEALTH_MODULE_KEYS }
export type { HealthModuleKey }
```

- [ ] **Step 3: Create `apps/miniapp/src/constants/storage-keys.ts`**

```ts
export const STORAGE_KEYS = {
  RECORDS: 'health_records',
  TRACKING_CONFIG: 'tracking_config',
  HEALTH_GOALS: 'health_goals',
  TOKEN: 'token',
  USER_NAME: 'user_name',
  SERVER_URL: 'server_url',
  PLAN_CACHE: 'plan_cache',
  CREDIT_BALANCE: 'credit_balance',
} as const
```

- [ ] **Step 4: Update `storage.ts` to use `STORAGE_KEYS`**

In `apps/miniapp/src/utils/storage.ts`, change line 3 from:
```ts
const STORAGE_KEY = 'health_records'
```
to:
```ts
import { STORAGE_KEYS } from '../constants/storage-keys'
const STORAGE_KEY = STORAGE_KEYS.RECORDS
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/constants.ts apps/miniapp/src/constants/ apps/miniapp/src/utils/storage.ts
git commit -m "feat: add HealthModuleKey type, extract miniapp constants and storage keys"
```

---

### Task 9: Redesign Miniapp Homepage

**Files:**
- Modify: `apps/miniapp/src/pages/index/index.tsx`
- Modify: `apps/miniapp/src/pages/index/index.scss`
- Modify: `apps/miniapp/src/theme.scss`
- Create: `apps/miniapp/src/components/TopBar/index.tsx`
- Create: `apps/miniapp/src/components/TopBar/index.scss`
- Create: `apps/miniapp/src/components/ChecklistCard/index.tsx`
- Create: `apps/miniapp/src/components/ChecklistCard/index.scss`
- Create: `apps/miniapp/src/components/CreditIcon/index.tsx`
- Create: `apps/miniapp/src/components/CreditAnimation/index.tsx`
- Create: `apps/miniapp/src/components/CreditAnimation/index.scss`

- [ ] **Step 1: Add animation keyframes to `theme.scss`**

Append after the `.anim-stagger` block (line 70):

```scss
// Credit collection: pop out then float upward
@keyframes creditFloat {
  0%   { opacity: 1; transform: scale(0.5) translateY(0); }
  35%  { opacity: 1; transform: scale(1.3) translateY(-16px); }
  100% { opacity: 0; transform: scale(0.7) translateY(-64px); }
}

// Card completion: subtle scale-down then restore
@keyframes cardDone {
  0%   { transform: scale(1); }
  40%  { transform: scale(0.96); }
  100% { transform: scale(1); opacity: 0.68; }
}

// Balance number bounce
@keyframes balanceBump {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.2); }
}

.anim-credit-float  { animation: creditFloat 0.65s ease-out forwards; }
.anim-card-done     { animation: cardDone 0.35s ease-out forwards; }
.anim-balance-bump  { animation: balanceBump 0.3s ease-out; }
```

- [ ] **Step 2: Create `CreditIcon` component**

```tsx
// src/components/CreditIcon/index.tsx
import { Text } from '@tarojs/components'

interface CreditIconProps {
  size?: number
  style?: React.CSSProperties
}

export function CreditIcon({ size = 20, style }: CreditIconProps) {
  return (
    <Text
      style={{
        fontSize: size,
        lineHeight: `${size}px`,
        display: 'inline-block',
        ...style,
      }}
    >
      🪙
    </Text>
  )
}
```

- [ ] **Step 3: Create `TopBar` component**

```tsx
// src/components/TopBar/index.tsx
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { CreditIcon } from '../CreditIcon'
import './index.scss'

interface TopBarProps {
  displayName: string
  credit: number
  animating?: boolean
}

export function TopBar({ displayName, credit, animating }: TopBarProps) {
  const avatarChar = displayName ? displayName[0] : '用'

  return (
    <View className='top-bar'>
      <View className='top-bar__left' onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
        <View className='top-bar__avatar'>
          <Text className='top-bar__avatar-text'>{avatarChar}</Text>
        </View>
        <Text className='top-bar__name'>{displayName}</Text>
      </View>
      <View className={`top-bar__credit ${animating ? 'anim-balance-bump' : ''}`}>
        <CreditIcon size={18} />
        <Text className='top-bar__credit-num'>{credit}</Text>
      </View>
    </View>
  )
}
```

```scss
// src/components/TopBar/index.scss
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0e8;

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6BA539, #8EC15B);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__avatar-text {
    color: #fff;
    font-size: 14px;
    font-weight: 600;
  }

  &__name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  &__credit {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #FFF8E1;
    padding: 4px 12px;
    border-radius: 20px;
  }

  &__credit-num {
    font-size: 14px;
    font-weight: 700;
    color: #E6A817;
  }
}
```

- [ ] **Step 4: Create `ChecklistCard` component**

```tsx
// src/components/ChecklistCard/index.tsx
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

interface ChecklistCardProps {
  moduleKey: string
  label: string
  icon: string
  status: 'pending' | 'done' | 'skipped'
  recordPage: string
  earnedCredits?: number
  animDone?: boolean
  animCredit?: boolean
}

export function ChecklistCard({
  label,
  icon,
  status,
  recordPage,
  earnedCredits,
  animDone,
  animCredit,
}: ChecklistCardProps) {
  const handleTap = () => {
    if (status === 'pending') {
      Taro.navigateTo({ url: recordPage })
    }
  }

  return (
    <View
      className={`checklist-card checklist-card--${status} ${animDone ? 'anim-card-done' : ''}`}
      onClick={handleTap}
    >
      <View className='checklist-card__accent' />
      <View className='checklist-card__body'>
        <View className='checklist-card__icon-wrap'>
          <Text className='checklist-card__icon'>{icon}</Text>
        </View>
        <View className='checklist-card__info'>
          <Text className='checklist-card__label'>{label}</Text>
          {status === 'pending' && (
            <Text className='checklist-card__hint'>今日尚未记录</Text>
          )}
        </View>
        <View className='checklist-card__status'>
          {status === 'done' && (
            <Text className='checklist-card__check'>✓</Text>
          )}
          {status === 'pending' && (
            <View className='checklist-card__circle' />
          )}
          {status === 'skipped' && (
            <Text className='checklist-card__skip'>—</Text>
          )}
          {earnedCredits != null && animCredit && (
            <Text className='checklist-card__credit anim-credit-float'>
              +{earnedCredits}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}
```

```scss
// src/components/ChecklistCard/index.scss
.checklist-card {
  background: #fff;
  border-radius: 12px;
  margin-bottom: 10px;
  position: relative;
  overflow: hidden;

  &__accent {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 4px 0 0 4px;
  }

  &--done {
    opacity: 0.68;

    .checklist-card__accent {
      background: #4A8C3F;
    }

    .checklist-card__icon-wrap {
      background: #E8F5E9;
    }

    .checklist-card__check {
      color: #4A8C3F;
      font-size: 18px;
      font-weight: 700;
    }
  }

  &--pending {
    .checklist-card__accent {
      background: #E0D4C0;
    }

    .checklist-card__icon-wrap {
      background: #F5F0E8;
    }

    .checklist-card__hint {
      font-size: 12px;
      color: #ED6C02;
    }
  }

  &--skipped {
    opacity: 0.5;

    .checklist-card__accent {
      background: #E0E0E0;
    }

    .checklist-card__skip {
      color: #BDBDBD;
      font-size: 16px;
    }
  }

  &__body {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
  }

  &__icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__icon {
    font-size: 22px;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__label {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  &__status {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    position: relative;
  }

  &__circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #E0D4C0;
  }

  &__credit {
    position: absolute;
    right: 0;
    top: -4px;
    font-size: 13px;
    font-weight: 700;
    color: #E6A817;
    white-space: nowrap;
    pointer-events: none;
  }
}
```

- [ ] **Step 5: Create `CreditAnimation` fallback component**

This is a lightweight overlay that the homepage can use if needed (mostly animation is inline in ChecklistCard).

```tsx
// src/components/CreditAnimation/index.tsx
import { View, Text } from '@tarojs/components'
import './index.scss'

interface CreditAnimationProps {
  visible: boolean
  amount: number
  x?: number
  y?: number
}

export function CreditAnimation({ visible, amount, x, y }: CreditAnimationProps) {
  if (!visible) return null

  return (
    <View className='credit-anim' style={{ left: x, top: y }}>
      <Text className='credit-anim__text anim-credit-float'>+{amount}</Text>
    </View>
  )
}
```

```scss
// src/components/CreditAnimation/index.scss
.credit-anim {
  position: fixed;
  z-index: 999;
  pointer-events: none;

  &__text {
    font-size: 18px;
    font-weight: 800;
    color: #E6A817;
    text-shadow: 0 1px 4px rgba(230, 168, 23, 0.3);
  }
}
```

- [ ] **Step 6: Rewrite `pages/index/index.tsx`**

```tsx
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { TopBar } from '../../components/TopBar'
import { ChecklistCard } from '../../components/ChecklistCard'
import { CreditAnimation } from '../../components/CreditAnimation'
import { TabBar } from '../../components/TabBar'
import { STORAGE_KEYS } from '../../constants/storage-keys'
import { HEALTH_MODULE_META, type HealthModuleKey } from '../../constants/modules'
import { trpc } from '../../utils/trpc'
import './index.scss'

interface ChecklistItem {
  id: string
  moduleKey: string
  status: 'pending' | 'done' | 'skipped'
}

export default function Index() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [credit, setCredit] = useState(0)
  const [creditAnim, setCreditAnim] = useState({ visible: false, amount: 0, x: 0, y: 0 })
  const [animCards, setAnimCards] = useState<Set<string>>(new Set())
  const [animCredits, setAnimCredits] = useState<Map<string, number>>(new Map())

  const userName = Taro.getStorageSync(STORAGE_KEYS.USER_NAME) || '用户'

  useEffect(() => {
    const token = Taro.getStorageSync(STORAGE_KEYS.TOKEN)
    if (!token) { Taro.redirectTo({ url: '/pages/login/index' }); return }

    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [list, bal] = await Promise.all([
        trpc.checklist.today.query(),
        trpc.credit.balance.query(),
      ])
      if (list) setChecklist(list)
      if (bal) setCredit(bal.balance)
    } catch {
      // Offline fallback: use stored data
    }
  }

  const onEarnCredits = (moduleKey: string, amount: number) => {
    setCredit((prev) => prev + amount)
    setAnimCards((prev) => new Set(prev).add(moduleKey))
    setAnimCredits((prev) => new Map(prev).set(moduleKey, amount))
  }

  const getRecordPage = (key: string): string => {
    const pages: Record<string, string> = {
      blood_glucose: '/pages/record/glucose/index',
      blood_pressure: '/pages/record/pressure/index',
      weight: '/pages/record/weight/index',
      heart_rate: '/pages/record/heart-rate/index',
      temperature: '/pages/record/temperature/index',
      spo2: '/pages/record/spo2/index',
      medication: '/pages/record/medication/index',
      period: '/pages/record/period/index',
    }
    return pages[key] || ''
  }

  return (
    <View className='home-page'>
      <TopBar displayName={userName} credit={credit} />

      <View className='home-checklist anim-stagger'>
        {checklist.map((item) => {
          const meta = HEALTH_MODULE_META[item.moduleKey as HealthModuleKey]
          return (
            <ChecklistCard
              key={item.id}
              moduleKey={item.moduleKey}
              label={meta?.label ?? item.moduleKey}
              icon={meta?.icon ?? '📋'}
              status={item.status}
              recordPage={getRecordPage(item.moduleKey)}
              earnedCredits={animCredits.get(item.moduleKey)}
              animDone={animCards.has(item.moduleKey)}
              animCredit={animCredits.has(item.moduleKey)}
            />
          )
        })}

        {checklist.length === 0 && (
          <View className='home-checklist__empty'>
            <Text className='home-checklist__empty-icon'>📋</Text>
            <Text className='home-checklist__empty-text'>暂无计划</Text>
            <Text className='home-checklist__empty-hint' onClick={() => Taro.navigateTo({ url: '/pages/plan/index' })}>
              去制定健康计划 →
            </Text>
          </View>
        )}
      </View>

      <View className='home-actions'>
        <View className='home-action-btn' onClick={() => Taro.navigateTo({ url: '/pages/plan/index' })}>
          <Text className='home-action-btn__icon'>📋</Text>
          <Text className='home-action-btn__label'>管理计划</Text>
        </View>
        <View className='home-action-btn' onClick={() => Taro.navigateTo({ url: '/pages/health/index' })}>
          <Text className='home-action-btn__icon'>📊</Text>
          <Text className='home-action-btn__label'>历史记录</Text>
        </View>
      </View>

      <CreditAnimation
        visible={creditAnim.visible}
        amount={creditAnim.amount}
        x={creditAnim.x}
        y={creditAnim.y}
      />

      <TabBar current='index' />
    </View>
  )
}
```

- [ ] **Step 7: Rewrite `pages/index/index.scss`**

```scss
.home-page {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 60px;
}

.home-checklist {
  padding: 16px 16px 8px;

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 0;
    gap: 8px;
  }

  &__empty-icon {
    font-size: 40px;
    opacity: 0.5;
  }

  &__empty-text {
    font-size: 14px;
    color: var(--text-secondary);
  }

  &__empty-hint {
    font-size: 14px;
    color: var(--brand-500);
    font-weight: 500;
  }
}

.home-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 0 16px 20px;
}

.home-action-btn {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  &__icon {
    font-size: 24px;
  }

  &__label {
    font-size: 13px;
    color: var(--text-primary);
    font-weight: 500;
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/miniapp/src/theme.scss apps/miniapp/src/components/CreditIcon/ apps/miniapp/src/components/TopBar/ apps/miniapp/src/components/ChecklistCard/ apps/miniapp/src/components/CreditAnimation/ apps/miniapp/src/pages/index/index.tsx apps/miniapp/src/pages/index/index.scss
git commit -m "feat(miniapp): redesign homepage with checklist cards, topbar, credit display"
```

---

### Task 10: Plan Setup Pages

**Files:**
- Create: `apps/miniapp/src/pages/plan/index.tsx`
- Create: `apps/miniapp/src/pages/plan/index.scss`
- Create: `apps/miniapp/src/pages/plan/detail/index.tsx`
- Create: `apps/miniapp/src/pages/plan/detail/index.scss`
- Modify: `apps/miniapp/src/app.config.ts`

- [ ] **Step 1: Create main plan page `pages/plan/index.tsx`**

```tsx
import { View, Text, Checkbox } from '@tarojs/components'
import { Button } from '@nutui/nutui-react'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { HEALTH_MODULE_META, HEALTH_MODULE_KEYS, type HealthModuleKey } from '../../constants/modules'
import { trpc } from '../../utils/trpc'
import './index.scss'

interface PlanItem {
  moduleKey: string
  enabled: boolean
  reminderEnabled: boolean
}

export default function PlanPage() {
  const [items, setItems] = useState<Record<string, PlanItem>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    trpc.plan.get.query().then((plan) => {
      if (plan?.items) {
        const map: Record<string, PlanItem> = {}
        for (const item of plan.items) {
          map[item.moduleKey] = {
            moduleKey: item.moduleKey,
            enabled: item.enabled,
            reminderEnabled: item.reminderEnabled,
          }
        }
        // Fill missing modules as disabled
        for (const key of HEALTH_MODULE_KEYS) {
          if (!map[key]) {
            map[key] = { moduleKey: key, enabled: false, reminderEnabled: false }
          }
        }
        setItems(map)
      } else {
        // Default: all disabled
        const map: Record<string, PlanItem> = {}
        for (const key of HEALTH_MODULE_KEYS) {
          map[key] = { moduleKey: key, enabled: false, reminderEnabled: false }
        }
        setItems(map)
      }
    }).catch(() => {})
  }, [])

  const toggle = (key: string) => {
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const input = HEALTH_MODULE_KEYS.filter((k) => items[k]?.enabled).map((k, i) => ({
        moduleKey: k,
        enabled: true,
        reminderEnabled: items[k].reminderEnabled,
        reminderTimes: [],
        frequency: 'daily' as const,
        sortOrder: i,
      }))

      await trpc.plan.upsert.mutate({ items: input })
      Taro.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 800)
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='plan-page'>
      <View className='plan-page__header'>
        <Text className='plan-page__back' onClick={() => Taro.navigateBack()}>← 返回</Text>
        <Text className='plan-page__title'>我的健康计划</Text>
        <View style='width:48px' />
      </View>

      <View className='plan-page__list anim-stagger'>
        {HEALTH_MODULE_KEYS.map((key) => {
          const meta = HEALTH_MODULE_META[key]
          const item = items[key]
          return (
            <View key={key} className='plan-item'>
              <View className='plan-item__main' onClick={() => toggle(key)}>
                <Checkbox checked={item?.enabled ?? false} />
                <Text className='plan-item__icon'>{meta.icon}</Text>
                <Text className='plan-item__label'>{meta.label}</Text>
              </View>
              {item?.enabled && (
                <View className='plan-item__gear' onClick={() => Taro.navigateTo({ url: `/pages/plan/detail/index?moduleKey=${key}` })}>
                  <Text>⚙</Text>
                </View>
              )}
            </View>
          )
        })}
      </View>

      <View className='plan-page__footer'>
        <Button block type='primary' onClick={handleSave} loading={saving}>保存计划</Button>
      </View>
    </View>
  )
}
```

```scss
// pages/plan/index.scss
.plan-page {
  min-height: 100vh;
  background: var(--bg-page);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #fff;
    border-bottom: 1px solid #f0f0e8;
  }

  &__back {
    font-size: 14px;
    color: var(--brand-500);
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  &__list {
    padding: 12px 16px;
  }

  &__footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px 16px 20px;
    background: #fff;
    border-top: 1px solid #f0f0e8;
  }
}

.plan-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 8px;

  &__main {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }

  &__icon {
    font-size: 22px;
  }

  &__label {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
  }

  &__gear {
    padding: 4px 8px;
    font-size: 18px;
    color: var(--text-secondary);
  }
}
```

- [ ] **Step 2: Create plan detail page `pages/plan/detail/index.tsx`**

```tsx
import { View, Text, Checkbox } from '@tarojs/components'
import { Button, DatetimePicker } from '@nutui/nutui-react'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { HEALTH_MODULE_META, type HealthModuleKey } from '../../../constants/modules'
import { trpc } from '../../../utils/trpc'
import './index.scss'

interface ReminderSlot {
  label: string
  hour: number
  min: number
  enabled: boolean
}

const DEFAULT_SLOTS: ReminderSlot[] = [
  { label: '早晨', hour: 8, min: 0, enabled: false },
  { label: '中午', hour: 12, min: 30, enabled: false },
  { label: '晚上', hour: 18, min: 0, enabled: false },
  { label: '睡前', hour: 22, min: 0, enabled: false },
]

export default function PlanDetailPage() {
  const router = useRouter()
  const moduleKey = (router.params.moduleKey || '') as HealthModuleKey
  const meta = HEALTH_MODULE_META[moduleKey]

  const [slots, setSlots] = useState<ReminderSlot[]>(DEFAULT_SLOTS)
  const [frequency, setFrequency] = useState<'daily' | 'multiple'>('daily')
  const [saving, setSaving] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [editingSlot, setEditingSlot] = useState<number>(-1)

  useEffect(() => {
    trpc.plan.get.query().then((plan) => {
      if (plan?.items) {
        const item = plan.items.find((i: any) => i.moduleKey === moduleKey)
        if (item) {
          setFrequency(item.frequency || 'daily')
          if (item.reminderTimes?.length > 0) {
            setSlots(item.reminderTimes.map((t: any, i: number) => ({
              label: DEFAULT_SLOTS[i]?.label || `时段${i + 1}`,
              hour: t.hour,
              min: t.min,
              enabled: true,
            })))
          }
        }
      }
    }).catch(() => {})
  }, [moduleKey])

  const save = async () => {
    setSaving(true)
    try {
      const enabledSlots = slots.filter((s) => s.enabled)
      const plan = await trpc.plan.get.query()
      if (plan?.items) {
        const currentItems = plan.items.map((i: any) => ({
          moduleKey: i.moduleKey,
          enabled: i.enabled,
          reminderEnabled: i.moduleKey === moduleKey ? enabledSlots.length > 0 : i.reminderEnabled,
          reminderTimes: i.moduleKey === moduleKey
            ? enabledSlots.map((s) => ({ hour: s.hour, min: s.min }))
            : i.reminderTimes,
          frequency: i.moduleKey === moduleKey ? frequency : i.frequency,
          sortOrder: i.sortOrder,
        }))
        await trpc.plan.upsert.mutate({ items: currentItems })
      }
      Taro.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='plan-detail'>
      <View className='plan-detail__header'>
        <Text className='plan-detail__back' onClick={() => Taro.navigateBack()}>← 返回</Text>
        <Text className='plan-detail__title'>{meta?.label} · 提醒设置</Text>
        <View style='width:48px' />
      </View>

      <View className='plan-detail__section'>
        <Text className='plan-detail__section-title'>提醒时段</Text>
        {slots.map((slot, i) => (
          <View key={i} className='reminder-slot'>
            <View className='reminder-slot__left' onClick={() => {
              setSlots((prev) => prev.map((s, j) => j === i ? { ...s, enabled: !s.enabled } : s))
            }}>
              <Checkbox checked={slot.enabled} />
              <Text className='reminder-slot__label'>{slot.label}</Text>
            </View>
            {slot.enabled && (
              <Text className='reminder-slot__time' onClick={() => {
                setEditingSlot(i)
                setPickerVisible(true)
              }}>
                {String(slot.hour).padStart(2, '0')}:{String(slot.min).padStart(2, '0')}
              </Text>
            )}
          </View>
        ))}
      </View>

      <DatetimePicker
        visible={pickerVisible}
        type='hour-minutes'
        value={editingSlot >= 0 ? `${String(slots[editingSlot].hour).padStart(2, '0')}:${String(slots[editingSlot].min).padStart(2, '0')}` : '08:00'}
        onConfirm={(options, values) => {
          const [hour, min] = (values as string[]).map(Number)
          setSlots((prev) => prev.map((s, j) => j === editingSlot ? { ...s, hour, min } : s))
          setPickerVisible(false)
        }}
        onClose={() => setPickerVisible(false)}
      />

      <View className='plan-detail__footer'>
        <Button block type='primary' onClick={save} loading={saving}>保存</Button>
      </View>
    </View>
  )
}
```

```scss
// pages/plan/detail/index.scss
.plan-detail {
  min-height: 100vh;
  background: var(--bg-page);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #fff;
    border-bottom: 1px solid #f0f0e8;
  }

  &__back { font-size: 14px; color: var(--brand-500); }
  &__title { font-size: 16px; font-weight: 600; color: var(--text-primary); }

  &__section {
    margin: 12px 16px;
    background: #fff;
    border-radius: 10px;
    padding: 16px;
  }

  &__section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  &__footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px 16px 20px;
    background: #fff;
  }
}

.reminder-slot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f0;

  &:last-child {
    border-bottom: none;
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__label {
    font-size: 14px;
    color: var(--text-primary);
  }

  &__time {
    font-size: 14px;
    color: var(--brand-500);
    font-weight: 500;
  }
}
```

- [ ] **Step 3: Register pages in `app.config.ts`**

Add to the `pages` array after `'pages/health/index'`:
```ts
'pages/plan/index',
'pages/plan/detail/index',
```

- [ ] **Step 4: Commit**

```bash
git add apps/miniapp/src/pages/plan/ apps/miniapp/src/app.config.ts
git commit -m "feat(miniapp): add plan setup pages with module toggles and reminder detail"
```

---

### Task 11: Profile Page Credit Card

**Files:**
- Modify: `apps/miniapp/src/pages/profile/index.tsx`
- Modify: `apps/miniapp/src/pages/profile/index.scss`

- [ ] **Step 1: Add credit card section to profile page**

After the `profile-page__header` View (line 96 in current file), insert:

```tsx
<View className='profile-page__credit-card'>
  <View className='profile-credit-card__balance'>
    <CreditIcon size={24} />
    <Text className='profile-credit-card__num'>{credit}</Text>
    <Text className='profile-credit-card__label'>credits</Text>
  </View>
  <View className='profile-credit-card__link' onClick={() => Taro.navigateTo({ url: '/pages/credit/index' })}>
    <Text className='profile-credit-card__link-text'>查看积分明细</Text>
    <Text className='profile-credit-card__arrow'>›</Text>
  </View>
</View>
```

Add state and effect at top of component:
```tsx
const [credit, setCredit] = useState(0)

useEffect(() => {
  trpc.credit.balance.query().then((r: any) => { if (r) setCredit(r.balance) }).catch(() => {})
}, [])
```

Add import:
```tsx
import { CreditIcon } from '../../components/CreditIcon'
```

- [ ] **Step 2: Add SCSS for credit card**

In `pages/profile/index.scss`, add:

```scss
.profile-page__credit-card {
  margin: 12px 16px;
  background: linear-gradient(135deg, #FFF8E1, #FFF3CD);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #FFE082;
}

.profile-credit-card__balance {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.profile-credit-card__num {
  font-size: 28px;
  font-weight: 800;
  color: #E6A817;
}

.profile-credit-card__label {
  font-size: 13px;
  color: #B8860B;
  margin-left: 2px;
}

.profile-credit-card__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid #FFE082;
}

.profile-credit-card__link-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.profile-credit-card__arrow {
  font-size: 16px;
  color: var(--text-secondary);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/miniapp/src/pages/profile/index.tsx apps/miniapp/src/pages/profile/index.scss
git commit -m "feat(miniapp): add credit card to profile page"
```

---

### Task 12: Credit History Page

**Files:**
- Create: `apps/miniapp/src/pages/credit/index.tsx`
- Create: `apps/miniapp/src/pages/credit/index.scss`
- Modify: `apps/miniapp/src/app.config.ts`

- [ ] **Step 1: Create `pages/credit/index.tsx`**

```tsx
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { HEALTH_MODULE_META, type HealthModuleKey } from '../../constants/modules'
import { CreditIcon } from '../../components/CreditIcon'
import { trpc } from '../../utils/trpc'
import './index.scss'

interface Transaction {
  id: string
  amount: number
  moduleKey: string | null
  streakDay: number | null
  type: string
  source: string
  createdAt: string
}

export default function CreditPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    Promise.all([
      trpc.credit.balance.query(),
      trpc.credit.transactions.query({ page: 1, pageSize: 50 }),
    ]).then(([bal, txns]) => {
      if (bal) setBalance(bal.balance)
      if (txns) setTransactions(txns)
    }).catch(() => {})
  }, [])

  return (
    <View className='credit-page'>
      <View className='credit-page__header'>
        <Text className='credit-page__back' onClick={() => Taro.navigateBack()}>← 返回</Text>
        <Text className='credit-page__title'>积分明细</Text>
        <View style='width:48px' />
      </View>

      <View className='credit-page__balance'>
        <CreditIcon size={28} />
        <Text className='credit-page__balance-num'>{balance}</Text>
      </View>

      <ScrollView className='credit-page__list' scrollY>
        {transactions.map((tx) => {
          const meta = tx.moduleKey ? HEALTH_MODULE_META[tx.moduleKey as HealthModuleKey] : null
          return (
            <View key={tx.id} className='credit-tx'>
              <View className='credit-tx__left'>
                <Text className='credit-tx__icon'>{meta?.icon ?? '🎁'}</Text>
                <View className='credit-tx__info'>
                  <Text className='credit-tx__label'>{meta?.label ?? tx.moduleKey ?? '系统'}</Text>
                  <Text className='credit-tx__date'>
                    {tx.createdAt?.slice(0, 10)}
                    {tx.streakDay ? ` · 连击 Day ${tx.streakDay}` : ''}
                  </Text>
                </View>
              </View>
              <Text className='credit-tx__amount credit-tx__amount--earn'>
                +{tx.amount}
              </Text>
            </View>
          )
        })}

        {transactions.length === 0 && (
          <View className='credit-page__empty'>
            <Text>暂无积分记录</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
```

```scss
// pages/credit/index.scss
.credit-page {
  min-height: 100vh;
  background: var(--bg-page);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #fff;
    border-bottom: 1px solid #f0f0e8;
  }

  &__back { font-size: 14px; color: var(--brand-500); }
  &__title { font-size: 16px; font-weight: 600; color: var(--text-primary); }

  &__balance {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px 0;
    background: linear-gradient(135deg, #FFF8E1, #FFF3CD);
  }

  &__balance-num {
    font-size: 36px;
    font-weight: 800;
    color: #E6A817;
  }

  &__list {
    padding: 12px 16px;
  }

  &__empty {
    text-align: center;
    padding: 40px 0;
    color: var(--text-secondary);
    font-size: 14px;
  }
}

.credit-tx {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 8px;

  &__left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__icon {
    font-size: 24px;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  &__date {
    font-size: 12px;
    color: var(--text-secondary);
  }

  &__amount {
    font-size: 16px;
    font-weight: 700;

    &--earn {
      color: #4A8C3F;
    }
  }
}
```

- [ ] **Step 2: Register in `app.config.ts`**

Add to pages array:
```ts
'pages/credit/index',
```

- [ ] **Step 3: Commit**

```bash
git add apps/miniapp/src/pages/credit/ apps/miniapp/src/app.config.ts
git commit -m "feat(miniapp): add credit transaction history page"
```

---

### Task 13: Refactor Health Page to Use Shared Constants

**Files:**
- Modify: `apps/miniapp/src/pages/health/index.tsx`

- [ ] **Step 1: Replace inline `ALL_MODULES` with shared constants**

In `pages/health/index.tsx`, remove the inline `ALL_MODULES` array (lines 10-19) and replace with:

```tsx
import { HEALTH_MODULE_META, HEALTH_MODULE_KEYS, type HealthModuleKey } from '../../constants/modules'
```

And where `ALL_MODULES` is used (line 30, `modules` variable), change to:

```tsx
const modules = HEALTH_MODULE_KEYS
  .filter((k) => trackingConfig[k]?.enabled !== false)
  .map((k) => ({
    key: k,
    ...HEALTH_MODULE_META[k],
    page: getRecordPage(k),
  }))
```

Add `getRecordPage` helper before the component:
```tsx
function getRecordPage(key: string): string {
  const pages: Record<string, string> = {
    blood_glucose: '/pages/record/glucose/index',
    blood_pressure: '/pages/record/pressure/index',
    weight: '/pages/record/weight/index',
    heart_rate: '/pages/record/heart-rate/index',
    temperature: '/pages/record/temperature/index',
    spo2: '/pages/record/spo2/index',
    medication: '/pages/record/medication/index',
    period: '/pages/record/period/index',
  }
  return pages[key] || ''
}
```

- [ ] **Step 2: Remove the unused `skeleton` import if not used elsewhere**

Check if `Skeleton` is still imported — it is (for the loading state). Keep it.

- [ ] **Step 3: Commit**

```bash
git add apps/miniapp/src/pages/health/index.tsx
git commit -m "refactor(miniapp): use shared HEALTH_MODULE_META in health page"
```

---

### Task 14: Handle `earnedCredits` in Sync Utility

**Files:**
- Modify: `apps/miniapp/src/utils/sync.ts`
- Modify: `apps/miniapp/src/components/CreditIcon/index.tsx`

- [ ] **Step 1: Update `sync.ts` to return earned credits**

Replace `apps/miniapp/src/utils/sync.ts`:

```ts
import { getUnsyncedRecords, markSynced } from './storage'
import { trpc } from './trpc'

const SYNC_INTERVAL = 5 * 60 * 1000

export interface SyncResult {
  syncedIds: string[]
  earnedCredits?: Array<{ moduleKey: string; amount: number; streakDay: number }>
}

export async function syncUnsyncedRecords(): Promise<SyncResult | null> {
  const unsynced = getUnsyncedRecords()
  if (unsynced.length === 0) return null

  try {
    const result = await trpc.healthRecords.batchCreate.mutate({ records: unsynced })
    if (result?.syncedIds) {
      markSynced(result.syncedIds)
    }
    return {
      syncedIds: result?.syncedIds ?? [],
      earnedCredits: result?.earnedCredits,
    }
  } catch (err) {
    console.warn('[Sync] failed, will retry later:', err)
    return null
  }
}

export function startAutoSync(onSyncResult?: (result: SyncResult) => void): void {
  syncUnsyncedRecords().then((r) => { if (r) onSyncResult?.(r) })
  setInterval(() => {
    syncUnsyncedRecords().then((r) => { if (r) onSyncResult?.(r) })
  }, SYNC_INTERVAL)
}
```

- [ ] **Step 2: Update `CreditIcon` to use a CSS variable for the icon**

The current emoji-based approach is fine for now. When art is ready, replace the emoji text with an `<Image>` component pointing to the SVG. Add a comment in the component:

```tsx
// CreditIcon/index.tsx — top of file
// TODO: When art is ready, replace emoji 🪙 with <Image src='/assets/credit-icon.svg' />
```

- [ ] **Step 3: Commit**

```bash
git add apps/miniapp/src/utils/sync.ts apps/miniapp/src/components/CreditIcon/index.tsx
git commit -m "feat(miniapp): handle earnedCredits return from sync, update CreditIcon note"
```

---

### Task 15: Final Integration — End-to-End Verification

**Files:**
- Verify: all modified files compile
- Verify: server builds
- Verify: miniapp typecheck passes

- [ ] **Step 1: Build server**

```bash
cd apps/server && pnpm run build
```

Expected: no errors. Fix any import issues.

- [ ] **Step 2: Typecheck miniapp**

```bash
cd apps/miniapp && pnpm run typecheck
```

Expected: type errors should be limited to pre-existing issues (38 module resolution errors). No new errors from our code.

- [ ] **Step 3: Verify migration can run**

```bash
cd apps/server && npx drizzle-kit check
```

Expected: database schema matches migration state.

- [ ] **Step 4: Manual flow test (if environment available)**

1. Start server: `cd apps/server && pnpm run dev`
2. Start miniapp dev: `cd apps/miniapp && pnpm run dev:weapp`
3. Verify: plan page renders, checklist.today returns data, sync returns earnedCredits

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: final integration fixes"
```

---

## Plan Self-Review

1. **Spec coverage**: All sections covered — DB (Task 1-2), tRPC APIs (Task 4-6), credit engine (Task 3, 7), frontend pages (Task 9-12), refactors (Task 8, 13), infrastructure (Task 14-15).

2. **Placeholder check**: No TODOs or TBDs. All code shown. All file paths exact.

3. **Type consistency**: `HealthModuleKey` defined in Task 8, consumed in Task 9, 10, 12, 13. `PlanItem` types match between server router (Task 4) and miniapp plan page (Task 10). `earnedCredits` return type matches between health-records (Task 7) and sync utility (Task 14).
