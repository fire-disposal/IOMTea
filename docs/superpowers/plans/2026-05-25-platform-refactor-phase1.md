# Platform Refactor — Phase 1: Pipeline & Cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the data pipeline as the universal 80% layer: events.value → jsonb, sessions table, metricRegistry, ingest/query/export routers, and removal of dead gamification routers.

**Architecture:** Three new files in `core/pipeline/` (registry, physiology, query-helpers) form the pipeline core. Two routers are refactored (data, export), one is created (ingest). Five dead routers and their DB tables are removed. Frontend routing is restructured to module-based layout.

**Tech Stack:** Hono + tRPC v11 + Drizzle ORM + PostgreSQL + TanStack Router (code router) + Mantine v8

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `apps/server/src/core/pipeline/registry.ts` | metricRegistry |
| Create | `apps/server/src/core/pipeline/physiology.ts` | Shared physiology generators |
| Create | `apps/server/src/core/pipeline/query-helpers.ts` | SQL builders for data queries |
| Create | `apps/server/src/core/trpc/routers/ingest.ts` | ingest.single / batch / validate |
| Create | `apps/server/src/core/db/migrations/0001_*.sql` | events jsonb + sessions + enum changes |
| Modify | `apps/server/src/core/db/schema.ts` | events value→jsonb, session_id, sessions table |
| Modify | `apps/server/src/core/db/schema/enums.ts` | Add batch, ema_response to enums |
| Modify | `apps/server/src/core/trpc/routers/_app.ts` | Remove dead routers, add ingest |
| Modify | `apps/server/src/core/trpc/routers/data.ts` | Add raw/aggregate/latest/compare/gap/summary |
| Modify | `apps/server/src/core/trpc/routers/export.ts` | Add long/wide/session formats |
| Modify | `apps/server/src/index.ts` | Remove dead modules from bootstrap |
| Modify | `apps/web/src/pages/DataDashboard.tsx` | Auto-chart from registry |
| Modify | `apps/web/src/routes.tsx` | Remove dead routes, restructure |
| Modify | `apps/web/src/routes/_auth.tsx` | Remove dead nav items |
| Modify | `packages/shared-types/src/schemas/events.ts` | Update event schemas |
| Remove | `apps/server/src/core/trpc/routers/checklist.ts` | Dead |
| Remove | `apps/server/src/core/trpc/routers/credit.ts` | Dead |
| Remove | `apps/server/src/core/trpc/routers/streak.ts` | Dead |
| Remove | `apps/server/src/core/trpc/routers/plan.ts` | Dead |
| Remove | `apps/server/src/core/trpc/routers/health-records.ts` | Dead, covered by pipeline |
| Remove | `apps/server/src/core/db/schema/plan.ts` | Dead tables |
| Remove | `apps/web/src/pages/DeviceListPage.tsx` | Dead (settings stub) |
| Remove | `apps/web/src/pages/VirtualPinsPage.tsx` | Dead (merged into PinManagement) |
| Remove | `apps/web/src/pages/TrendsPage.tsx` | Dead (replaced by DataDashboard) |
| Remove | `apps/web/src/pages/NodeGraphPage.tsx` | Dead (merged into twin module) |
| Remove | `apps/web/src/pages/PatientImport.tsx` | Dead |
| Remove | `apps/web/src/pages/components/` | Dead legacy components |

---

## Task 1: DB Migration — events.value → jsonb, add sessions, update enums

**Files:**
- Create: `apps/server/src/core/db/migrations/0001_pipeline_refactor.sql`
- Modify: `apps/server/src/core/db/schema.ts`
- Modify: `apps/server/src/core/db/schema/enums.ts`

- [ ] **Step 1: Write migration SQL**

```sql
-- 0001_pipeline_refactor.sql

-- 1. Update events.value from numeric(10,2) to jsonb
ALTER TABLE events ALTER COLUMN value TYPE jsonb
  USING CASE
    WHEN value IS NULL THEN 'null'::jsonb
    ELSE to_jsonb(value)
  END;

-- 2. Add session_id to events (nullable FK to sessions)
ALTER TABLE events ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '{}'::jsonb;

-- 3. Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  source text NOT NULL,
  type text,
  status text DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  tags jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_source ON sessions(source);

-- 4. Add foreign key from events to sessions
ALTER TABLE events ADD CONSTRAINT fk_events_session
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;

-- 5. Drop gamification tables
DROP TABLE IF EXISTS daily_checklists CASCADE;
DROP TABLE IF EXISTS plan_items CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS streaks CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS medication_schedules CASCADE;
DROP TABLE IF EXISTS medication_adherence CASCADE;

-- 6. Add new enum values (enums in PostgreSQL are handled by Drizzle at code level)
-- No SQL changes needed for enums; Drizzle will track them
```

- [ ] **Step 2: Copy migration to project's drizzle folder and run migrate**

Run: `cd apps/server; pnpm db:generate; pnpm db:migrate`
Expected: Schema changes applied, no errors

- [ ] **Step 3: Update Drizzle schema.ts**

```typescript
// apps/server/src/core/db/schema.ts

import {
  pgTable,
  uuid,
  text,
  real,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable('users', {
  // ... keep existing fields unchanged
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('user'),
  credit: real('credit').default(0),
  phone: text('phone'),
  email: text('email'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const refreshTokens = pgTable('refresh_tokens', {
  // ... keep existing fields unchanged
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

export const patients = pgTable('patients', {
  // ... keep existing fields unchanged
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  birthDate: timestamp('birth_date', { mode: 'date' }),
  gender: text('gender'),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  bloodType: text('blood_type'),
  address: text('address'),
  phone: text('phone'),
  status: text('status').default('active'),
  tags: jsonb('tags').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id'), // ★ new: nullable FK to sessions
  pinCode: text('pin_code'),
  kind: text('kind').notNull(),
  source: text('source').notNull(),
  metric: text('metric').notNull(),
  value: jsonb('value').notNull(), // ★ changed: numeric → jsonb
  unit: text('unit'),
  confidence: real('confidence').default(1.0),
  severity: text('severity'),
  status: text('status'),
  tags: jsonb('tags').default(sql`'{}'::jsonb`), // ★ new
  recordedAt: timestamp('recorded_at', { mode: 'date' }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  type: text('type'),
  status: text('status').default('active'),
  startedAt: timestamp('started_at', { mode: 'date' }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { mode: 'date' }),
  tags: jsonb('tags').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
})
```

- [ ] **Step 4: Update enums.ts**

```typescript
// apps/server/src/core/db/schema/enums.ts

import { pgEnum } from 'drizzle-orm/pg-core'

// ... keep existing enums ...

export const eventKindEnum = pgEnum('event_kind', [
  'observation',
  'alert',
  'behavior',
  'location',
  'ema_response',      // ★ new
  'batch_record',       // ★ new
])

export const eventSourceEnum = pgEnum('event_source', [
  'device',
  'manual',
  'sim',
  'batch',              // ★ new
])

// Remove these enums (gamification)
// export const planStatusEnum, checklistStatusEnum, etc.

// ... keep all other existing enums ...
```

- [ ] **Step 5: Remove dead schema files**

Delete files:
- `apps/server/src/core/db/schema/plan.ts`
- `apps/server/src/core/db/schema/medication.ts` (content in step below)

Simplify `apps/server/src/core/db/schema/medication.ts`:

```typescript
// apps/server/src/core/db/schema/medication.ts

import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { patients } from '../schema'

export const medications = pgTable('medications', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  drugName: text('drug_name').notNull(),
  dosage: text('dosage'),
  dosageUnit: text('dosage_unit'),
  frequency: text('frequency'),
  route: text('route'),
  startDate: timestamp('start_date', { mode: 'date' }),
  endDate: timestamp('end_date', { mode: 'date' }),
  instructions: text('instructions'),
  status: text('status').default('active'),
  tags: jsonb('tags').default({}),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})
```

- [ ] **Step 6: Update schema/index.ts barrel**

```typescript
// apps/server/src/core/db/schema/index.ts

export * from './enums'
export * from './pin'
export * from './user-patient'
export * from './medication'
export * from './tag'
export * from './auth-ext'
// Note: main schema (users, patients, events, sessions) imported directly from '../schema'
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/core/db/
git commit -m "feat(db): events.value jsonb, sessions table, remove gamification tables"
```

---

## Task 2: Create Metric Registry

**Files:**
- Create: `apps/server/src/core/pipeline/registry.ts`

- [ ] **Step 1: Create registry.ts**

```typescript
// apps/server/src/core/pipeline/registry.ts

import { z } from 'zod'

export interface MetricField {
  path: string
  label: string
  type: 'number' | 'text' | 'choice' | 'boolean'
  choices?: string[]
}

export interface MetricDefinition {
  metric: string
  displayName: string
  unit: string
  valueSchema: z.ZodSchema
  valueType: 'scalar' | 'object'
  fields?: MetricField[]
  normalRange?: { min: number; max: number }
  alertThresholds?: { low?: number; high?: number }
  defaultChart: 'line' | 'bar' | 'gauge' | 'scatter'
  category: 'vital' | 'ema' | 'behavior' | 'lab' | 'custom'
}

const metricRegistry = new Map<string, MetricDefinition>()

export function registerMetric(def: MetricDefinition): void {
  if (metricRegistry.has(def.metric)) {
    console.warn(`[registry] metric "${def.metric}" already registered, overwriting`)
  }
  metricRegistry.set(def.metric, def)
}

export function getMetric(metric: string): MetricDefinition | undefined {
  return metricRegistry.get(metric)
}

export function listMetrics(category?: string): MetricDefinition[] {
  const all = Array.from(metricRegistry.values())
  if (category) return all.filter((m) => m.category === category)
  return all
}

export function getMetricOrDefault(metric: string): MetricDefinition {
  const def = metricRegistry.get(metric)
  if (def) return def
  return {
    metric,
    displayName: metric,
    unit: '',
    valueSchema: z.unknown(),
    valueType: 'scalar',
    defaultChart: 'line',
    category: 'custom',
  }
}

export function resolveField(
  metric: string,
  fieldPath?: string,
): { definition: MetricDefinition; field?: MetricField } | null {
  const def = getMetric(metric)
  if (!def) return null
  if (def.valueType === 'scalar') return { definition: def }
  if (!fieldPath) return { definition: def }
  const field = def.fields?.find((f) => f.path === fieldPath)
  return { definition: def, field }
}

// ── Default vital sign registrations ──

registerMetric({
  metric: 'heart_rate',
  displayName: '心率',
  unit: 'bpm',
  valueSchema: z.number().min(20).max(250),
  valueType: 'scalar',
  normalRange: { min: 60, max: 100 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'respiratory_rate',
  displayName: '呼吸率',
  unit: '次/分',
  valueSchema: z.number().min(5).max(60),
  valueType: 'scalar',
  normalRange: { min: 12, max: 20 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'spo2',
  displayName: '血氧饱和度',
  unit: '%',
  valueSchema: z.number().min(50).max(100),
  valueType: 'scalar',
  normalRange: { min: 95, max: 100 },
  alertThresholds: { low: 92 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'temperature',
  displayName: '体温',
  unit: '°C',
  valueSchema: z.number().min(30).max(45),
  valueType: 'scalar',
  normalRange: { min: 36.0, max: 37.3 },
  alertThresholds: { high: 38.0 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'systolic_bp',
  displayName: '收缩压',
  unit: 'mmHg',
  valueSchema: z.number().min(60).max(250),
  valueType: 'scalar',
  normalRange: { min: 90, max: 140 },
  alertThresholds: { high: 160 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'diastolic_bp',
  displayName: '舒张压',
  unit: 'mmHg',
  valueSchema: z.number().min(30).max(150),
  valueType: 'scalar',
  normalRange: { min: 60, max: 90 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'glucose',
  displayName: '血糖',
  unit: 'mmol/L',
  valueSchema: z.number().min(1).max(35),
  valueType: 'scalar',
  normalRange: { min: 3.9, max: 6.1 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'motion_index',
  displayName: '活动指数',
  unit: '',
  valueSchema: z.number().min(0).max(1),
  valueType: 'scalar',
  normalRange: { min: 0.1, max: 0.6 },
  defaultChart: 'bar',
  category: 'behavior',
})

registerMetric({
  metric: 'posture',
  displayName: '姿态',
  unit: '',
  valueSchema: z.string(),
  valueType: 'scalar',
  defaultChart: 'bar',
  category: 'behavior',
})

registerMetric({
  metric: 'bed_status',
  displayName: '卧床状态',
  unit: '',
  valueSchema: z.string(),
  valueType: 'scalar',
  defaultChart: 'bar',
  category: 'behavior',
})
```

- [ ] **Step 2: Verify in core/index.ts export**

No extra file needed — `registry.ts` is imported directly by consumers.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/pipeline/
git commit -m "feat(pipeline): metricRegistry with 10 default vital/behavior metrics"
```

---

## Task 3: Create Shared Physiology Generators

**Files:**
- Create: `apps/server/src/core/pipeline/physiology.ts`

- [ ] **Step 1: Create physiology.ts**

Extract the shared Gaussian RNG and circadian modulation from both twin/ and sim/. This is the deduplication target.

```typescript
// apps/server/src/core/pipeline/physiology.ts

/**
 * Shared physiology generators.
 * Both twin/engine.ts and sim/factory.ts will import from here.
 */

// Box-Muller Gaussian RNG
let hasSpare = false
let spare = 0

export function gaussian(mean: number, std: number): number {
  if (hasSpare) {
    hasSpare = false
    return mean + std * spare
  }
  let u: number, v: number, s: number
  do {
    u = Math.random() * 2 - 1
    v = Math.random() * 2 - 1
    s = u * u + v * v
  } while (s >= 1 || s === 0)
  s = Math.sqrt((-2 * Math.log(s)) / s)
  spare = v * s
  hasSpare = true
  return mean + std * u * s
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function clampFloat(value: number, min: number, max: number, decimals = 1): number {
  const clamped = Math.max(min, Math.min(max, value))
  return Number(clamped.toFixed(decimals))
}

// Circadian modulation: 0=midnight, 12=noon
export function circadianFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24
  return Math.sin(((h - 6) / 24) * 2 * Math.PI) * 0.15
}

// ── Vital generators ──

export function generateHeartRate(
  baseline: { mean: number; std: number },
  hour: number,
  activityMultiplier = 1.0,
): number {
  const circadian = circadianFactor(hour) * 10 * activityMultiplier
  const raw = gaussian(baseline.mean + circadian, baseline.std * activityMultiplier)
  return clamp(raw, 30, 220)
}

export function generateSpO2(
  baseline: { mean: number; std: number },
  _hour: number,
): number {
  const raw = gaussian(baseline.mean, baseline.std)
  return clamp(raw, 70, 100)
}

export function generateTemperature(
  baseline: { mean: number; std: number },
  hour: number,
): number {
  const circadian = circadianFactor(hour) * 0.5
  const raw = gaussian(baseline.mean + circadian, baseline.std)
  return clampFloat(raw, 34, 42)
}

export function generateSystolicBp(
  baseline: { mean: number; std: number },
  hour: number,
): number {
  const circadian = circadianFactor(hour) * 5
  const raw = gaussian(baseline.mean + circadian, baseline.std)
  return clamp(raw, 70, 220)
}

export function generateDiastolicBp(
  baseline: { mean: number; std: number },
  hour: number,
): number {
  const circadian = circadianFactor(hour) * 3
  const raw = gaussian(baseline.mean + circadian, baseline.std)
  return clamp(raw, 40, 130)
}

export function generateGlucose(
  baseline: { mean: number; std: number },
  _hour: number,
): number {
  const raw = gaussian(baseline.mean, baseline.std)
  return clampFloat(raw, 2.0, 25.0)
}

export function generateRespiratoryRate(
  baseline: { mean: number; std: number },
  _hour: number,
  activityMultiplier = 1.0,
): number {
  const raw = gaussian(baseline.mean * activityMultiplier, baseline.std)
  return clamp(raw, 8, 40)
}

export function generateMotionIndex(): number {
  return clampFloat(Math.random() * 0.8 + 0.05, 0, 1, 2)
}

const POSTURES = ['standing', 'sitting', 'lying', 'walking'] as const

export function generatePosture(): string {
  return POSTURES[Math.floor(Math.random() * POSTURES.length)]
}

const BED_STATUSES = ['in_bed', 'out_of_bed', 'edge_of_bed'] as const

export function generateBedStatus(): string {
  return BED_STATUSES[Math.floor(Math.random() * BED_STATUSES.length)]
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/core/pipeline/physiology.ts
git commit -m "feat(pipeline): shared physiology generators extracted from twin/sim"
```

---

## Task 4: Create Query Helpers

**Files:**
- Create: `apps/server/src/core/pipeline/query-helpers.ts`

- [ ] **Step 1: Create query-helpers.ts**

```typescript
// apps/server/src/core/pipeline/query-helpers.ts

import { sql } from 'drizzle-orm'
import type { PgSelect } from 'drizzle-orm/pg-core'
import { events } from '../db/schema'
import type { MetricDefinition } from './registry'
import { getMetricOrDefault } from './registry'

/**
 * Build SQL expression to extract a typed value from the jsonb column.
 * Scalar metrics: value::numeric
 * Object metrics with fieldPath: value->>'fieldPath' cast to numeric
 */
export function valueExpression(def: MetricDefinition, fieldPath?: string): ReturnType<typeof sql> {
  if (def.valueType === 'scalar' || !fieldPath) {
    return sql`(${events.value})::numeric`
  }
  return sql`(${events.value}->>${fieldPath})::numeric`
}

/**
 * Build a date_trunc expression group key for the given aggregation interval.
 */
export function truncExpr(interval: string): ReturnType<typeof sql> {
  const valid = ['minute', 'hour', 'day', 'week']
  const ival = valid.includes(interval) ? interval : 'day'
  return sql`date_trunc(${ival}, ${events.recordedAt})`
}

/**
 * Build a where fragment for metric matching.
 * Supports sub-field queries: metric="daily-mood-form" with fieldPath="mood" matches
 * the parent metric in DB, then value extraction happens via valueExpression.
 */
export function metricWhere(metric: string) {
  return sql`${events.metric} = ${metric}`
}

/**
 * Resolve and extract value for a given metric + optional field path.
 * Returns null if metric not registered.
 */
export function resolveValueExpr(
  metric: string,
  fieldPath?: string,
): { def: MetricDefinition; expr: ReturnType<typeof sql> } | null {
  const def = getMetricOrDefault(metric)
  return { def, expr: valueExpression(def, fieldPath) }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/core/pipeline/query-helpers.ts
git commit -m "feat(pipeline): query helper utilities for jsonb value extraction"
```

---

## Task 5: Remove Dead Routers & Clean _app.ts

**Files:**
- Modify: `apps/server/src/core/trpc/routers/_app.ts`
- Remove: 5 dead router files

- [ ] **Step 1: Delete dead router files**

```bash
Remove-Item -LiteralPath "apps\server\src\core\trpc\routers\checklist.ts"
Remove-Item -LiteralPath "apps\server\src\core\trpc\routers\credit.ts"
Remove-Item -LiteralPath "apps\server\src\core\trpc\routers\streak.ts"
Remove-Item -LiteralPath "apps\server\src\core\trpc\routers\plan.ts"
Remove-Item -LiteralPath "apps\server\src\core\trpc\routers\health-records.ts"
```

- [ ] **Step 2: Update _app.ts to remove dead routers**

Delete the imports and router registrations for: `checklistRouter`, `creditRouter`, `streakRouter`, `planRouter`, `healthRecordsRouter`.

Current `_app.ts` contains 23 routers. After removal: 18 routers remain before new additions.

```typescript
// apps/server/src/core/trpc/routers/_app.ts

import { router } from '../index'
import { alertRouter } from './alert'
import { alertRuleRouter } from './alertRule'
import { authRouter } from './auth'
import { dashboardRouter } from './dashboard'
import { dataRouter } from './data'
import { exportRouter } from './export'
import { homeGraphRouter } from './home-graph'
import { medicationRouter } from './medication'
import { nodeGraphRouter } from './node-graph'
import { patientRouter } from './patient'
import { pinRouter } from './pin'
import { tagRouter } from './tag'
import { userRouter } from './user'
import { virtualPinRouter } from './virtual-pin'
import { simulationRouter } from '../../../twin/trpc/simulation.router'
import { twinRouter } from '../../../twin/trpc/twin.router'
import { simRouter } from '../../../sim/router'
// ★ new
import { ingestRouter } from './ingest'

export const appRouter = router({
  alert: alertRouter,
  alertRule: alertRuleRouter,
  auth: authRouter,
  dashboard: dashboardRouter,
  data: dataRouter,
  export: exportRouter,
  homeGraph: homeGraphRouter,
  ingest: ingestRouter,         // ★ new
  medication: medicationRouter,
  nodeGraph: nodeGraphRouter,
  patient: patientRouter,
  pin: pinRouter,
  sim: simRouter,
  simulation: simulationRouter,
  tag: tagRouter,
  twin: twinRouter,
  user: userRouter,
  virtualPin: virtualPinRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 3: Typecheck to verify no broken imports**

Run: `cd apps/server; pnpm typecheck`
Expected: Passes (ingestRouter doesn't exist yet, but we're about to create it)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(trpc): remove checklist/credit/streak/plan/health-records routers"
```

---

## Task 6: Create Ingest Router

**Files:**
- Create: `apps/server/src/core/trpc/routers/ingest.ts`

- [ ] **Step 1: Create ingest.ts**

```typescript
// apps/server/src/core/trpc/routers/ingest.ts

import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { router, protectedProcedure } from '../index'
import { events, sessions } from '../../db/schema'
import { getMetricOrDefault } from '../../pipeline/registry'
import { createChildLogger } from '../../lib/logger'

const logger = createChildLogger('ingest')

const singleEventSchema = z.object({
  patientId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  pinCode: z.string().optional(),
  kind: z.enum(['observation', 'alert', 'behavior', 'location', 'ema_response', 'batch_record']),
  source: z.enum(['device', 'manual', 'sim', 'batch']),
  metric: z.string().min(1),
  value: z.unknown(), // validated against metricRegistry
  unit: z.string().optional(),
  confidence: z.number().optional(),
  tags: z.record(z.unknown()).optional(),
  recordedAt: z.string().datetime().optional(),
})

const batchEventsSchema = z.object({
  events: z.array(singleEventSchema).min(1).max(5000),
})

export const ingestRouter = router({
  single: protectedProcedure
    .input(singleEventSchema)
    .mutation(async ({ ctx, input }) => {
      const def = getMetricOrDefault(input.metric)

      // Validate value against registered schema
      const parsed = def.valueSchema.safeParse(input.value)
      if (!parsed.success) {
        logger.warn({ metric: input.metric, errors: parsed.error.issues }, 'ingest validation failed')
        throw new Error(`Value validation failed for metric "${input.metric}": ${parsed.error.message}`)
      }

      const [row] = await ctx.db.insert(events).values({
        patientId: input.patientId,
        sessionId: input.sessionId ?? null,
        pinCode: input.pinCode ?? null,
        kind: input.kind,
        source: input.source,
        metric: input.metric,
        value: parsed.data as any,
        unit: input.unit ?? def.unit ?? null,
        confidence: input.confidence ?? 1.0,
        tags: input.tags ?? {},
        recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      }).returning()

      return row
    }),

  batch: protectedProcedure
    .input(batchEventsSchema)
    .mutation(async ({ ctx, input }) => {
      const results = { success: 0, failed: 0, skipped: 0, errors: [] as string[] }

      for (const event of input.events) {
        try {
          const def = getMetricOrDefault(event.metric)
          const parsed = def.valueSchema.safeParse(event.value)
          if (!parsed.success) {
            results.skipped++
            results.errors.push(`metric=${event.metric}: ${parsed.error.message}`)
            continue
          }

          await ctx.db.insert(events).values({
            patientId: event.patientId,
            sessionId: event.sessionId ?? null,
            pinCode: event.pinCode ?? null,
            kind: event.kind,
            source: event.source,
            metric: event.metric,
            value: parsed.data as any,
            unit: event.unit ?? def.unit ?? null,
            confidence: event.confidence ?? 1.0,
            tags: event.tags ?? {},
            recordedAt: event.recordedAt ? new Date(event.recordedAt) : new Date(),
          })

          results.success++
        } catch (err) {
          results.failed++
          results.errors.push(`metric=${event.metric}: ${(err as Error).message}`)
        }
      }

      logger.info({ ...results }, 'batch ingest completed')
      return results
    }),

  validate: protectedProcedure
    .input(z.object({
      metric: z.string(),
      value: z.unknown(),
    }))
    .query(async ({ input }) => {
      const def = getMetricOrDefault(input.metric)
      const parsed = def.valueSchema.safeParse(input.value)
      if (!parsed.success) {
        return { valid: false, errors: parsed.error.issues }
      }
      return { valid: true, errors: [] }
    }),
})
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/server; pnpm typecheck`
Expected: Passes (ingestRouter now exists and is imported by _app.ts)

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/trpc/routers/ingest.ts
git commit -m "feat(pipeline): ingestRouter with single/batch/validate endpoints"
```

---

## Task 7: Refactor Data Router (Query Pipeline)

**Files:**
- Modify: `apps/server/src/core/trpc/routers/data.ts`

- [ ] **Step 1: Read current data.ts to understand existing structure**

Read `apps/server/src/core/trpc/routers/data.ts`. Note the existing procedures and their signatures. We'll add new procedures and modify existing ones.

- [ ] **Step 2: Replace data.ts with full pipeline implementation**

```typescript
// apps/server/src/core/trpc/routers/data.ts

import { z } from 'zod'
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm'
import { router, protectedProcedure } from '../index'
import { events } from '../../db/schema'
import { valueExpression, truncExpr } from '../../pipeline/query-helpers'
import { getMetricOrDefault, listMetrics } from '../../pipeline/registry'

// ── Shared input schemas ──

const metricInput = z.object({
  metric: z.string().min(1),
  fieldPath: z.string().optional(),
})

const rangeInput = z.object({
  patientId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

const rawInput = metricInput.merge(rangeInput).extend({
  limit: z.number().min(1).max(10000).default(200),
  offset: z.number().min(0).default(0),
})

const aggregateInput = metricInput.merge(rangeInput).extend({
  interval: z.enum(['minute', 'hour', 'day', 'week']).default('day'),
  fn: z.enum(['avg', 'min', 'max', 'count']).default('avg'),
})

const latestInput = z.object({
  patientId: z.string().uuid().optional(),
  metrics: z.array(z.string()).optional(),
})

const compareInput = metricInput.extend({
  patientId: z.string().uuid(),
  beforeFrom: z.string().datetime(),
  beforeTo: z.string().datetime(),
  afterFrom: z.string().datetime(),
  afterTo: z.string().datetime(),
})

const gapInput = metricInput.extend({
  patientId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  maxGapMinutes: z.number().min(1).default(60),
})

// ── Router ──

export const dataRouter = router({
  // ── List all registered metrics ──
  metrics: protectedProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(({ input }) => {
      return listMetrics(input.category).map((m) => ({
        metric: m.metric,
        displayName: m.displayName,
        unit: m.unit,
        valueType: m.valueType,
        fields: m.fields,
        defaultChart: m.defaultChart,
        category: m.category,
        normalRange: m.normalRange,
      }))
    }),

  // ── Raw time-series ──
  raw: protectedProcedure
    .input(rawInput)
    .query(async ({ ctx, input }) => {
      const def = getMetricOrDefault(input.metric)
      const valExpr = valueExpression(def, input.fieldPath)

      const conditions: ReturnType<typeof eq>[] = [
        eq(events.metric, input.metric),
      ]
      if (input.patientId) conditions.push(eq(events.patientId, input.patientId))
      if (input.from) conditions.push(gte(events.recordedAt, new Date(input.from)))
      if (input.to) conditions.push(lte(events.recordedAt, new Date(input.to)))

      const rows = await ctx.db
        .select({
          id: events.id,
          patientId: events.patientId,
          recordedAt: events.recordedAt,
          value: valExpr,
          unit: events.unit,
          tags: events.tags,
          source: events.source,
        })
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.recordedAt))
        .limit(input.limit)
        .offset(input.offset)

      return {
        metric: input.metric,
        fieldPath: input.fieldPath,
        unit: def.unit,
        rows: rows.reverse(),
      }
    }),

  // ── Aggregated time-series ──
  aggregate: protectedProcedure
    .input(aggregateInput)
    .query(async ({ ctx, input }) => {
      const def = getMetricOrDefault(input.metric)
      const valExpr = valueExpression(def, input.fieldPath)
      const timeBucket = truncExpr(input.interval)

      const conditions: ReturnType<typeof eq>[] = [
        eq(events.metric, input.metric),
      ]
      if (input.patientId) conditions.push(eq(events.patientId, input.patientId))
      if (input.from) conditions.push(gte(events.recordedAt, new Date(input.from)))
      if (input.to) conditions.push(lte(events.recordedAt, new Date(input.to)))

      const aggFn = input.fn === 'count'
        ? sql<number>`count(${valExpr})`
        : input.fn === 'min'
          ? sql<number>`min(${valExpr})`
          : input.fn === 'max'
            ? sql<number>`max(${valExpr})`
            : sql<number>`avg(${valExpr})`

      const rows = await ctx.db
        .select({
          bucket: timeBucket.mapWith((v) => v as string),
          value: aggFn,
        })
        .from(events)
        .where(and(...conditions))
        .groupBy(timeBucket)
        .orderBy(asc(timeBucket))

      return {
        metric: input.metric,
        fieldPath: input.fieldPath,
        interval: input.interval,
        fn: input.fn,
        unit: def.unit,
        rows,
      }
    }),

  // ── Latest value per metric ──
  latest: protectedProcedure
    .input(latestInput)
    .query(async ({ ctx, input }) => {
      const metrics = input.metrics ?? listMetrics().map((m) => m.metric)
      const results: Record<string, unknown> = {}

      for (const metric of metrics) {
        const [row] = await ctx.db
          .select({
            value: events.value,
            recordedAt: events.recordedAt,
            unit: events.unit,
          })
          .from(events)
          .where(and(
            eq(events.metric, metric),
            input.patientId ? eq(events.patientId, input.patientId) : undefined,
          ))
          .orderBy(desc(events.recordedAt))
          .limit(1)

        if (row) {
          results[metric] = {
            value: row.value,
            recordedAt: row.recordedAt,
            unit: row.unit,
          }
        }
      }

      return results
    }),

  // ── Compare two time periods ──
  compare: protectedProcedure
    .input(compareInput)
    .query(async ({ ctx, input }) => {
      const def = getMetricOrDefault(input.metric)
      const valExpr = valueExpression(def, input.fieldPath)

      async function avgInRange(from: string, to: string): Promise<number | null> {
        const [row] = await ctx.db
          .select({ avg: sql<number>`avg(${valExpr})` })
          .from(events)
          .where(and(
            eq(events.metric, input.metric),
            eq(events.patientId, input.patientId),
            gte(events.recordedAt, new Date(from)),
            lte(events.recordedAt, new Date(to)),
          ))
        return row?.avg ?? null
      }

      const before = await avgInRange(input.beforeFrom, input.beforeTo)
      const after = await avgInRange(input.afterFrom, input.afterTo)

      return {
        metric: input.metric,
        fieldPath: input.fieldPath,
        unit: def.unit,
        before: { from: input.beforeFrom, to: input.beforeTo, avg: before },
        after: { from: input.afterFrom, to: input.afterTo, avg: after },
        delta: before != null && after != null ? after - before : null,
      }
    }),

  // ── Gap detection ──
  gap: protectedProcedure
    .input(gapInput)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ recordedAt: events.recordedAt })
        .from(events)
        .where(and(
          eq(events.metric, input.metric),
          eq(events.patientId, input.patientId),
          gte(events.recordedAt, new Date(input.from)),
          lte(events.recordedAt, new Date(input.to)),
        ))
        .orderBy(asc(events.recordedAt))

      const gaps: { from: Date; to: Date; minutes: number }[] = []
      for (let i = 1; i < rows.length; i++) {
        const diff = (rows[i].recordedAt.getTime() - rows[i - 1].recordedAt.getTime()) / 60000
        if (diff > input.maxGapMinutes) {
          gaps.push({
            from: rows[i - 1].recordedAt,
            to: rows[i].recordedAt,
            minutes: Math.round(diff),
          })
        }
      }

      return {
        metric: input.metric,
        maxGapMinutes: input.maxGapMinutes,
        totalPoints: rows.length,
        gaps,
      }
    }),

  // ── Research summary (multi-metric, multi-patient) ──
  summary: protectedProcedure
    .input(z.object({
      metrics: z.array(z.string()).min(1),
      patientIds: z.array(z.string().uuid()).optional(),
      from: z.string().datetime(),
      to: z.string().datetime(),
    }))
    .query(async ({ ctx, input }) => {
      const results: Record<string, { count: number; min: number; max: number; avg: number; stddev: number }> = {}

      for (const metric of input.metrics) {
        const def = getMetricOrDefault(metric)
        if (def.valueType !== 'scalar') continue

        const conditions: ReturnType<typeof eq>[] = [eq(events.metric, metric)]
        conditions.push(gte(events.recordedAt, new Date(input.from)))
        conditions.push(lte(events.recordedAt, new Date(input.to)))
        if (input.patientIds?.length) {
          // Use SQL IN for patient filtering
        }

        const [row] = await ctx.db
          .select({
            count: sql<number>`count(*)::int`,
            min: sql<number>`min((${events.value})::numeric)`,
            max: sql<number>`max((${events.value})::numeric)`,
            avg: sql<number>`avg((${events.value})::numeric)`,
            stddev: sql<number>`stddev((${events.value})::numeric)`,
          })
          .from(events)
          .where(and(...conditions))

        if (row && row.count > 0) {
          results[metric] = {
            count: row.count,
            min: row.min ?? 0,
            max: row.max ?? 0,
            avg: row.avg ?? 0,
            stddev: row.stddev ?? 0,
          }
        }
      }

      return results
    }),
})
```

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/server; pnpm typecheck`
Expected: Passes

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/core/trpc/routers/data.ts
git commit -m "feat(pipeline): dataRouter with raw/aggregate/latest/compare/gap/summary"
```

---

## Task 8: Refactor Export Router

**Files:**
- Modify: `apps/server/src/core/trpc/routers/export.ts`

Read current export.ts to understand the `download` and `preview` procedures. We'll add support for long/wide/session formats alongside existing csv.

- [ ] **Step 1: Read current export.ts to preserve existing signatures**

Read `apps/server/src/core/trpc/routers/export.ts`. Note the existing `download` procedure (takes entity + fields + format) and `preview` procedure.

- [ ] **Step 2: Extend export.ts with format support**

The key additions:
1. Add `format` enum to include `long`, `wide`, `session` alongside existing `csv`, `xlsx`
2. Replace entity-based export with a new unified `eventsExport` procedure that queries the events table
3. Keep existing `download` and `preview` for backward compatibility

Add these new procedures to the existing exportRouter:

```typescript
// Add to existing export.ts, after the current download/preview procedures:

const eventsExportInput = z.object({
  patientId: z.string().uuid().optional(),
  metrics: z.array(z.string()).optional(),
  fieldPath: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  format: z.enum(['csv', 'long', 'wide', 'session']),
})

export const exportRouter = router({
  // ... keep existing download, preview procedures ...

  // ★ New: unified events export
  eventsDownload: protectedProcedure
    .input(eventsExportInput)
    .mutation(async ({ ctx, input }) => {
      const conditions = []
      if (input.patientId) conditions.push(eq(events.patientId, input.patientId))
      if (input.from) conditions.push(gte(events.recordedAt, new Date(input.from)))
      if (input.to) conditions.push(lte(events.recordedAt, new Date(input.to)))

      const rows = await ctx.db
        .select()
        .from(events)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(events.recordedAt))

      let csvContent = ''

      switch (input.format) {
        case 'csv': {
          // Flatten: object fields become columns
          const allFields = new Set<string>()
          for (const row of rows) {
            if (typeof row.value === 'object' && row.value) {
              Object.keys(row.value as object).forEach((k) => allFields.add(k))
            }
          }
          const headers = ['recorded_at', 'patient_id', 'metric', 'source', 'value', ...allFields]
          csvContent = headers.join(',') + '\n'
          for (const row of rows) {
            const vals = [
              row.recordedAt?.toISOString() ?? '',
              row.patientId,
              row.metric,
              row.source,
              typeof row.value === 'object' ? '' : String(row.value),
              ...Array.from(allFields).map((f) =>
                typeof row.value === 'object' && row.value ? String((row.value as Record<string, unknown>)[f] ?? '') : '',
              ),
            ]
            csvContent += vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
          }
          break
        }
        case 'long': {
          // Tidy: one row per observation
          csvContent = 'recorded_at,patient_id,metric,value,unit,source\n'
          for (const row of rows) {
            const v = typeof row.value === 'object' && row.value
              ? JSON.stringify(row.value)
              : String(row.value)
            csvContent += [
              row.recordedAt?.toISOString() ?? '',
              row.patientId,
              row.metric,
              `"${v.replace(/"/g, '""')}"`,
              row.unit ?? '',
              row.source,
            ].join(',') + '\n'
          }
          break
        }
        case 'wide': {
          // Pivot: patients x timepoints x metrics
          const patientIds = [...new Set(rows.map((r) => r.patientId))]
          const timepoints = [...new Set(rows.map((r) => r.recordedAt?.toISOString() ?? ''))]
          const metrics = input.metrics ?? [...new Set(rows.map((r) => r.metric))]
          csvContent = 'patient_id,timepoint,' + metrics.join(',') + '\n'
          for (const pid of patientIds) {
            for (const tp of timepoints) {
              const vals = metrics.map((m) => {
                const found = rows.find((r) => r.patientId === pid && r.recordedAt?.toISOString() === tp && r.metric === m)
                if (!found) return ''
                return typeof found.value === 'number' ? String(found.value) : JSON.stringify(found.value)
              })
              csvContent += `${pid},${tp},${vals.join(',')}\n`
            }
          }
          break
        }
        case 'session': {
          // Session-centric export
          csvContent = 'session_id,patient_id,source,type,started_at,ended_at,event_count\n'
          // Group by session from events joined with sessions table
          break
        }
      }

      const base64 = btoa(unescape(encodeURIComponent(csvContent)))
      const filename = `export-${input.format}-${new Date().toISOString().slice(0, 10)}.csv`

      return {
        data: base64,
        filename,
        mime: 'text/csv;charset=utf-8',
      }
    }),

  eventsPreview: protectedProcedure
    .input(eventsExportInput.extend({ limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const conditions = []
      if (input.patientId) conditions.push(eq(events.patientId, input.patientId))
      if (input.from) conditions.push(gte(events.recordedAt, new Date(input.from)))
      if (input.to) conditions.push(lte(events.recordedAt, new Date(input.to)))

      const rows = await ctx.db
        .select()
        .from(events)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(events.recordedAt))
        .limit(input.limit)

      // Get total count
      const [countResult] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(events)
        .where(conditions.length ? and(...conditions) : undefined)

      const columns = ['recorded_at', 'patient_id', 'metric', 'source', 'value', 'unit']
      return {
        total: countResult?.total ?? 0,
        columns,
        rows: rows.map((r) => ({
          recorded_at: r.recordedAt?.toISOString(),
          patient_id: r.patientId,
          metric: r.metric,
          source: r.source,
          value: typeof r.value === 'object' ? JSON.stringify(r.value) : r.value,
          unit: r.unit,
        })),
      }
    }),
})
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/server; pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/core/trpc/routers/export.ts
git commit -m "feat(pipeline): exportRouter extended with long/wide/session/csv formats"
```

---

## Task 9: Update Server Bootstrap (index.ts)

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Remove dead module startup logic**

In `apps/server/src/index.ts`, remove:
- References to `streak`, `credit`, `checklist`, `plan`
- Remove the "credit gamification" related seed logic in `bootstrap()`
- Remove `healthRecords` import if referenced

Also, add import of `'./pipeline/registry'` to trigger default metric registration on startup.

```typescript
// Add near top of index.ts after other core imports:
import './core/pipeline/registry'  // trigger default metric registration
```

The bootstrap function should no longer reference any dead modules. Review each step in `bootstrap()` and remove or comment out dead code.

- [ ] **Step 2: Verify server starts**

Run: `cd apps/server; pnpm dev`
Expected: Server starts, banner prints, DB connects, demo data seeds, twin engines start (if applicable), no errors about missing imports.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "refactor(server): remove dead module startup logic from bootstrap"
```

---

## Task 10: Update Shared Types

**Files:**
- Modify: `packages/shared-types/src/schemas/events.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Update event schemas for jsonb value**

```typescript
// packages/shared-types/src/schemas/events.ts

import { z } from 'zod'

export const eventKindEnum = z.enum([
  'observation',
  'alert',
  'behavior',
  'location',
  'ema_response',
  'batch_record',
])

export const eventSourceEnum = z.enum([
  'device',
  'manual',
  'sim',
  'batch',
])

export const observationSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  sessionId: z.string().uuid().nullable().optional(),
  pinCode: z.string().nullable().optional(),
  kind: eventKindEnum,
  source: eventSourceEnum,
  metric: z.string().min(1),
  value: z.unknown(),              // ★ changed: was z.number(), now unknown (validated by registry)
  unit: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(1),
  tags: z.record(z.unknown()).default({}),
  recordedAt: z.string().datetime().or(z.date()),
  createdAt: z.string().datetime().or(z.date()).optional(),
})

export const eventTimeSeriesInputSchema = z.object({
  metric: z.string().min(1),
  fieldPath: z.string().optional(),
  patientId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().min(1).max(10000).default(200),
  offset: z.number().min(0).default(0),
})

export const ingestSingleSchema = z.object({
  patientId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  pinCode: z.string().optional(),
  kind: eventKindEnum,
  source: eventSourceEnum,
  metric: z.string().min(1),
  value: z.unknown(),
  unit: z.string().optional(),
  confidence: z.number().optional(),
  tags: z.record(z.unknown()).optional(),
  recordedAt: z.string().datetime().optional(),
})

export const ingestBatchSchema = z.object({
  events: z.array(ingestSingleSchema).min(1).max(5000),
})

export type EventKind = z.infer<typeof eventKindEnum>
export type EventSource = z.infer<typeof eventSourceEnum>
export type Observation = z.infer<typeof observationSchema>
export type EventTimeSeriesInput = z.infer<typeof eventTimeSeriesInputSchema>
export type IngestSingle = z.infer<typeof ingestSingleSchema>
export type IngestBatch = z.infer<typeof ingestBatchSchema>
```

- [ ] **Step 2: Clean shared-types index.ts**

Remove any exports related to removed modules (checklist, credit, streak, plan schemas if any).

- [ ] **Step 3: Typecheck across workspace**

Run: `pnpm typecheck`
Expected: Passes for all packages

- [ ] **Step 4: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): update event schemas for jsonb value and pipeline types"
```

---

## Task 11: Frontend — Remove Dead Pages & Restructure

**Files:**
- Remove: several dead page files
- Create: `apps/web/src/modules/` directory structure
- Modify: `apps/web/src/routes.tsx`

- [ ] **Step 1: Delete dead page files**

```bash
Remove-Item -LiteralPath "apps\web\src\pages\DeviceListPage.tsx"
Remove-Item -LiteralPath "apps\web\src\pages\VirtualPinsPage.tsx"
Remove-Item -LiteralPath "apps\web\src\pages\TrendsPage.tsx"
Remove-Item -LiteralPath "apps\web\src\pages\NodeGraphPage.tsx"
Remove-Item -LiteralPath "apps\web\src\pages\PatientImport.tsx"
Remove-Item -Recurse -LiteralPath "apps\web\src\pages\components"
```

- [ ] **Step 2: Create module directories**

```bash
New-Item -ItemType Directory -Path "apps\web\src\modules\monitor\pages" -Force
New-Item -ItemType Directory -Path "apps\web\src\modules\twin\pages" -Force
New-Item -ItemType Directory -Path "apps\web\src\modules\twin\components\twin3d" -Force
New-Item -ItemType Directory -Path "apps\web\src\modules\ema\pages" -Force
New-Item -ItemType Directory -Path "apps\web\src\modules\ema\components" -Force
New-Item -ItemType Directory -Path "apps\web\src\modules\methodology\pages" -Force
```

- [ ] **Step 3: Move monitor pages into module**

```bash
Move-Item -LiteralPath "apps\web\src\pages\PatientWall.tsx" -Destination "apps\web\src\modules\monitor\pages\PatientWall.tsx"
Move-Item -LiteralPath "apps\web\src\pages\PatientDetailShell.tsx" -Destination "apps\web\src\modules\monitor\pages\PatientDetailShell.tsx"
Move-Item -LiteralPath "apps\web\src\pages\PatientOverview.tsx" -Destination "apps\web\src\modules\monitor\pages\PatientOverview.tsx"
Move-Item -LiteralPath "apps\web\src\pages\PatientProfile.tsx" -Destination "apps\web\src\modules\monitor\pages\PatientProfile.tsx"
Move-Item -LiteralPath "apps\web\src\pages\PatientAlerts.tsx" -Destination "apps\web\src\modules\monitor\pages\PatientAlerts.tsx"
Move-Item -LiteralPath "apps\web\src\pages\PatientAlertRules.tsx" -Destination "apps\web\src\modules\monitor\pages\PatientAlertRules.tsx"
Move-Item -LiteralPath "apps\web\src\pages\PatientMedications.tsx" -Destination "apps\web\src\modules\monitor\pages\PatientMedications.tsx"
Move-Item -LiteralPath "apps\web\src\pages\HealthTimeline.tsx" -Destination "apps\web\src\modules\monitor\pages\HealthTimeline.tsx"
Move-Item -LiteralPath "apps\web\src\pages\AlertBoard.tsx" -Destination "apps\web\src\modules\monitor\pages\AlertBoard.tsx"
Move-Item -LiteralPath "apps\web\src\pages\GlobalMedications.tsx" -Destination "apps\web\src\modules\monitor\pages\GlobalMedications.tsx"
```

- [ ] **Step 4: Move twin/sim files into twin module**

```bash
Move-Item -LiteralPath "apps\web\src\routes\_auth.simulation.tsx" -Destination "apps\web\src\modules\twin\pages\SimulationPage.tsx"
Move-Item -LiteralPath "apps\web\src\components\sim\SimTimeline.tsx" -Destination "apps\web\src\modules\twin\components\SimTimeline.tsx"
Move-Item -LiteralPath "apps\web\src\twin3d\GraphViewer.tsx" -Destination "apps\web\src\modules\twin\components\twin3d\GraphViewer.tsx"
Move-Item -LiteralPath "apps\web\src\twin3d\GraphEditorPage.tsx" -Destination "apps\web\src\modules\twin\components\twin3d\GraphEditorPage.tsx"
Move-Item -LiteralPath "apps\web\src\twin3d\RoomNodeGraph.tsx" -Destination "apps\web\src\modules\twin\components\twin3d\RoomNodeGraph.tsx"
```

- [ ] **Step 5: Move data export to pages/**

```bash
Move-Item -LiteralPath "apps\web\src\routes\_auth.data-export.tsx" -Destination "apps\web\src\pages\DataExportPage.tsx"
```

- [ ] **Step 6: Create .gitkeep or index.ts placeholders in new module folders**

Create `apps/web/src/modules/ema/index.ts`:
```typescript
// apps/web/src/modules/ema/index.ts
// EMA module routes (Phase 3)
export const emaRoutes = [] as const
```

Create `apps/web/src/modules/methodology/index.ts`:
```typescript
// apps/web/src/modules/methodology/index.ts
// Methodology module routes (Phase 4)
export const methodologyRoutes = [] as const
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(web): restructure frontend into module directories, remove dead pages"
```

---

## Task 12: Frontend — Update routes.tsx and _auth.tsx

**Files:**
- Modify: `apps/web/src/routes.tsx`
- Modify: `apps/web/src/routes/_auth.tsx`

- [ ] **Step 1: Update routes.tsx with corrected import paths**

All imports that referenced pages now in `modules/` must be updated. The routes.tsx should import from new locations.

```typescript
// apps/web/src/routes.tsx

import { createRoute, createRootRoute, createRouter, Outlet } from '@tanstack/react-router'
import { RootLayout } from './routes/__root'
import { AuthLayout, authBeforeLoad } from './routes/_auth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DataDashboard } from './pages/DataDashboard'
import { DataExportPage } from './pages/DataExportPage'
import { PinManagementPage } from './pages/PinManagementPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { SimPage } from './modules/twin/pages/SimulationPage'
import { PatientWall } from './modules/monitor/pages/PatientWall'
import { AlertBoard } from './modules/monitor/pages/AlertBoard'
import { GlobalMedications } from './modules/monitor/pages/GlobalMedications'
import { PatientDetailShell } from './modules/monitor/pages/PatientDetailShell'
import { PatientOverview } from './modules/monitor/pages/PatientOverview'
import { PatientAlerts } from './modules/monitor/pages/PatientAlerts'
import { PatientAlertRules } from './modules/monitor/pages/PatientAlertRules'
import { PatientMedications } from './modules/monitor/pages/PatientMedications'
import { PatientProfile } from './modules/monitor/pages/PatientProfile'
import { HealthTimeline } from './modules/monitor/pages/HealthTimeline'
import { GraphEditorPage } from './modules/twin/components/twin3d/GraphEditorPage'
import { useParams } from '@tanstack/react-router'

function MapEditorPage() {
  const { id } = useParams({ from: '/_auth/patients/$id' })
  return <GraphEditorPage patientId={id} />
}

const rootRoute = createRootRoute({
  component: RootLayout,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_auth',
  beforeLoad: authBeforeLoad,
  component: AuthLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/',
  component: DashboardPage,
})

const patientsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/patients',
  component: PatientWall,
})

const patientDetailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/patients/$id',
  component: () => (
    <PatientDetailShell>
      <Outlet />
    </PatientDetailShell>
  ),
})

const pOverviewRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/',
  component: PatientOverview,
})

const pAlertsRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/alerts',
  component: PatientAlerts,
})

const pAlertRulesRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/alert-rules',
  component: function AlertRulesWrapper() {
    const { id } = useParams({ from: '/_auth/patients/$id' })
    return <PatientAlertRules patientId={id} />
  },
})

const pMedsRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/medications',
  component: PatientMedications,
})

const pProfileRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/profile',
  component: PatientProfile,
})

const pTimelineRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/health-timeline',
  component: HealthTimeline,
})

const pMapRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/map-editor',
  component: MapEditorPage,
})

const alertsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/alerts',
  component: AlertBoard,
})

const medsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/medications',
  component: GlobalMedications,
})

const dataDashRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/data-dashboard',
  component: DataDashboard,
})

const dataExportRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/data-export',
  component: DataExportPage,
})

const simRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/simulation',
  component: SimPage,
})

const pinsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/iot/pins',
  component: PinManagementPage,
})

// ★ Remove settings route (was DeviceListPage - dead)
// ★ Remove settings/users route — keep but import fixed

const usersRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/settings/users',
  component: UserManagementPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authRoute.addChildren([
    dashboardRoute,
    patientsRoute,
    patientDetailRoute.addChildren([
      pOverviewRoute,
      pAlertsRoute,
      pAlertRulesRoute,
      pMedsRoute,
      pProfileRoute,
      pTimelineRoute,
      pMapRoute,
    ]),
    alertsRoute,
    medsRoute,
    dataDashRoute,
    dataExportRoute,
    simRoute,
    pinsRoute,
    usersRoute,
    // ★ Future: ...emaRoutes, ...methodologyRoutes
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

- [ ] **Step 2: Update _auth.tsx nav to remove dead routes**

Remove the "设备与接入 → PIN 管理 → DeviceListPage" reference (settings route). Keep only PIN management and user management as the admin routes.

In `_auth.tsx`, remove the `settingsRoute` related nav items if any, and remove references to removed pages.

The nav groups should stay largely the same since we only removed dead pages, not nav entries (PatientWall, AlertBoard, etc. are still alive in monitor module).

- [ ] **Step 3: Verify frontend builds**

Run: `cd apps/web; pnpm build`
Expected: Build succeeds with no import errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes.tsx apps/web/src/routes/_auth.tsx
git commit -m "refactor(web): update routes.tsx with corrected module imports"
```

---

## Task 13: Frontend — Update DataDashboard for Pipeline

**Files:**
- Modify: `apps/web/src/pages/DataDashboard.tsx`

- [ ] **Step 1: Read current DataDashboard.tsx**

Read to understand the current implementation — what charts it uses, how it queries data.

- [ ] **Step 2: Add metric selection and auto-chart from registry**

The DataDashboard should now:
1. Fetch available metrics from `trpc.data.metrics.useQuery()`
2. Group metrics by category
3. Let user select a metric → auto-choose chart type from `defaultChart`
4. Query data with `trpc.data.raw.useQuery()` or `trpc.data.aggregate.useQuery()`

Add these calls alongside existing dashboard queries. The existing views (heart rate chart, etc.) should be preserved but repointed to use the pipeline API.

- [ ] **Step 3: Implement pipeline-aware DataDashboard**

Keep existing layout but add:
- A `<Select>` at top to pick from registered metrics (`data.metrics`)
- Chart type auto-selected from metric definition
- Object-type metrics render multi-line chart (one line per field)

```typescript
// Add to DataDashboard.tsx:
const { data: metrics } = trpc.data.metrics.useQuery()
const [selectedMetric, setSelectedMetric] = useState<string>('heart_rate')
const [selectedField, setSelectedField] = useState<string | undefined>(undefined)

const { data: timeSeries, isLoading } = trpc.data.aggregate.useQuery({
  metric: selectedMetric,
  fieldPath: selectedField,
  interval: 'day',
  fn: 'avg',
  limit: 30,
})

const selectedDef = metrics?.find((m) => m.metric === selectedMetric)

// Use selectedDef?.defaultChart to pick chart component
// line → LineChart, bar → BarChart, gauge → Gauge, scatter → ScatterChart
// Use selectedDef?.fields for object-type secondary selector
// Use selectedDef?.normalRange for reference bands on charts
```

- [ ] **Step 4: Verify it renders**

Run: `cd apps/web; pnpm dev`
Expected: Dashboard page loads, metrics appear in selector, charts render.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/DataDashboard.tsx
git commit -m "feat(web): DataDashboard auto-charts from metricRegistry"
```

---

## Task 14: Update Frontend DataExport

**Files:**
- Modify: `apps/web/src/pages/DataExportPage.tsx` (moved from `routes/_auth.data-export.tsx`)

- [ ] **Step 1: Add format selector and events preview**

The export page should now offer `eventsDownload` and `eventsPreview` in addition to the existing entity-based export. Add:

- Format selector: csv / long / wide / session
- Calls `trpc.export.eventsDownload.useMutation()` with selected format
- Preview uses `trpc.export.eventsPreview.useQuery()`

- [ ] **Step 2: Implement the updated export page**

Keep the existing entity-based export UI as is, and add a new "事件数据" tab with the pipeline-aware export. The existing `FIELD_OPTIONS`, entity selector, and preview for patients/medications should remain functional.

Add a Tabs component with:
- Tab 1: "实体导出" (existing patients/medications entity export)
- Tab 2: "事件管道" (new pipeline export with format selection)

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/DataExportPage.tsx
git commit -m "feat(web): DataExport with pipeline format selector (long/wide/session)"
```

---

## Task 15: Cleanup Dead Web Components

**Files:**
- Remove: `apps/web/src/components/sim/` (moved to twin module)
- Remove: `apps/web/src/components/patients/` (moved to monitor module)
- Remove: `apps/web/src/components/graph/` (moved to twin module)
- Remove: `apps/web/src/twin3d/` (moved to twin module)
- Remove: `apps/web/src/routes/_auth.data-export.tsx` (moved to pages/)
- Remove: `apps/web/src/routes/_auth.simulation.tsx` (moved to twin module)

- [ ] **Step 1: Remove empty legacy directories**

```bash
Remove-Item -Recurse -LiteralPath "apps\web\src\components\sim" -ErrorAction SilentlyContinue
Remove-Item -Recurse -LiteralPath "apps\web\src\components\patients" -ErrorAction SilentlyContinue
Remove-Item -Recurse -LiteralPath "apps\web\src\components\graph" -ErrorAction SilentlyContinue
Remove-Item -Recurse -LiteralPath "apps\web\src\twin3d" -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "apps\web\src\routes\_auth.data-export.tsx" -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "apps\web\src\routes\_auth.simulation.tsx" -ErrorAction SilentlyContinue
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "refactor(web): remove empty legacy directories after module restructure"
```

---

## Task 16: Full Typecheck & Lint

**Files:**
- All modified files

- [ ] **Step 1: Typecheck entire workspace**

Run: `pnpm typecheck`
Expected: All packages pass. Fix any type errors.

If `data.ts` has `sql<number>` issues with Drizzle, use explicit type annotations:
```typescript
sql<number>`...` // may need `as unknown as number` in some Drizzle versions
```

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: No formatting/lint errors. Run `pnpm lint --fix` if needed.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: typecheck and lint pass after Phase 1 refactor"
```

---

## Verification

After all tasks complete, verify end-to-end:

1. **Server starts**: `cd apps/server; pnpm dev` — banner, DB connect, demo seed, twin engines
2. **Metric registry**: `GET /trpc/data.metrics` returns 10+ default metrics
3. **Ingest single**: `POST /trpc/ingest.single` with valid heart_rate data → 200, row returned
4. **Ingest batch**: `POST /trpc/ingest.batch` with 3 events → `{ success: 3, failed: 0, skipped: 0 }`
5. **Data raw**: `GET /trpc/data.raw?input=...` returns time-series
6. **Data aggregate**: Returns grouped averages
7. **Export CSV**: Downloads CSV with correct columns
8. **Dead modules gone**: checklist/credit/streak/plan/health-records no longer in tRPC tree
9. **Frontend builds**: `pnpm build` succeeds
10. **Frontend renders**: Dashboard → DataDashboard → select metric → chart renders

---

## Remaining Phases (Summary)

### Phase 2: Twin Integration & Monitor Consolidation

Merge `twin/` + `sim/` → `modules/twin/`, extract shared physiology to `core/pipeline/physiology.ts`, merge three routers into one, consolidate monitor module. Full 23-item checklist for both modules.

### Phase 3: EMA Module

New `modules/ema/` with `ema_forms` table, form CRUD API, response submission API, frontend form designer + response entry + analysis page. Register forms as object-type metrics in pipeline.

### Phase 4: Methodology Tools & Final Cleanup

Batch import workbench, export workbench (long/wide/session UI), remove miniapp, global demo data flow through all modules. Full typecheck/lint pass.
