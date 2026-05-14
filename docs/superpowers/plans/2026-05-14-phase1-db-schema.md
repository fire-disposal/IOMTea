# Phase 1: 数据库 Schema 重构 — 实施计划

> **对于代理执行者（Agentic Workers）**：必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步实施。步骤使用 checkbox (`- [ ]`) 语法追踪。

**目标**：将现有 8 表 PostgreSQL schema 扩展为 29 表的完整医疗健康数据模型，包括用户认证、患者健康档案、设备、事件总线、用药管理、预约随访和数字孪生核心。

**架构**：Drizzle ORM schema 定义按模块拆分为多个文件（enums、auth、patient、device、event、medication、appointment、twin、system），通过 barrel index 统一导出。迁移由 `drizzle-kit generate` 自动生成 SQL。

**技术栈**：Drizzle ORM 0.38 + PostgreSQL 16 + Zod（shared-types schemas）

**参考规格**：`docs/superpowers/specs/2026-05-14-comprehensive-refactor-design.md`

---

### 前置准备

- 确认 PostgreSQL 运行中（docker compose up postgres）
- 确认 `DATABASE_URL` 环境变量正确
- 确认 `drizzle-kit generate` 和 `drizzle-kit migrate` 可用

---

### Task 1: 枚举定义文件 + 现有表改造

**文件**：
- 创建：`apps/server/src/core/db/schema/enums.ts`
- 修改：`apps/server/src/core/db/schema.ts`（移除枚举定义和 map_configs，保留表定义 + 新增字段）

**说明**：将所有 pgEnum 定义集中到 `enums.ts`，便于后续模块复用。同时对现有 `users`/`patients`/`devices`/`events` 表进行字段扩展（添加新字段，不删除现有字段以保证向后兼容）。

- [ ] **Step 1：创建枚举定义文件**

创建 `apps/server/src/core/db/schema/enums.ts`，包含所有枚举定义。

```typescript
// apps/server/src/core/db/schema/enums.ts
import { pgEnum } from 'drizzle-orm/pg-core'

// 现有枚举（从 schema.ts 迁移过来）
export const roleEnum = pgEnum('role', ['admin', 'doctor', 'nurse', 'caregiver', 'patient', 'family'])
export const deviceTypeEnum = pgEnum('device_type', ['mattress', 'vision', 'imu', 'generic', 'simulator', 'custom'])
export const deviceStatusEnum = pgEnum('device_status', ['active', 'inactive', 'maintenance', 'error'])
export const patientStatusEnum = pgEnum('patient_status', ['active', 'discharged', 'archived'])
export const alertSeverityEnum = pgEnum('alert_severity', ['critical', 'warning', 'info'])
export const alertStatusEnum = pgEnum('alert_status', ['active', 'acknowledged', 'resolved', 'expired'])
export const kindEnum = pgEnum('kind', ['observation', 'alert', 'behavior', 'location'])

// 新增枚举
export const userStatusEnum = pgEnum('user_status', ['active', 'disabled', 'pending'])
export const genderEnum = pgEnum('gender', ['male', 'female', 'other'])
export const bloodTypeEnum = pgEnum('blood_type', ['A', 'B', 'AB', 'O'])
export const conditionStatusEnum = pgEnum('condition_status', ['active', 'resolved', 'managed'])
export const allergySeverityEnum = pgEnum('allergy_severity', ['mild', 'moderate', 'severe'])
export const snapshotTypeEnum = pgEnum('snapshot_type', ['daily', 'weekly', 'monthly', 'discharge'])
export const eventSourceEnum = pgEnum('event_source', ['iot', 'cv', 'simulator', 'manual'])
export const medicationStatusEnum = pgEnum('medication_status', ['active', 'completed', 'paused', 'cancelled'])
export const medicationRouteEnum = pgEnum('medication_route', ['oral', 'injection', 'topical', 'inhalation', 'other'])
export const adherenceStatusEnum = pgEnum('adherence_status', ['taken', 'missed', 'skipped', 'delayed'])
export const confirmationMethodEnum = pgEnum('confirmation_method', ['self', 'family', 'auto', 'unknown'])
export const appointmentTypeEnum = pgEnum('appointment_type', ['checkup', 'followup', 'emergency', 'consultation', 'rehabilitation'])
export const appointmentStatusEnum = pgEnum('appointment_status', ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
export const followupTypeEnum = pgEnum('followup_type', ['phone', 'video', 'home_visit', 'clinic', 'message'])
export const entityCategoryEnum = pgEnum('entity_category', ['furniture', 'structure', 'sensor', 'actor', 'marker'])
export const orientationEnum = pgEnum('orientation', ['N', 'S', 'E', 'W'])
export const actorPostureEnum = pgEnum('actor_posture', ['lying', 'sitting', 'standing', 'walking'])
export const behaviorStateEnum = pgEnum('behavior_state', ['idle', 'moving', 'acting', 'sleeping', 'eating', 'toilet', 'shower'])
export const behaviorRuleTypeEnum = pgEnum('behavior_rule_type', ['schedule', 'trigger', 'routine'])
export const roomTypeEnum = pgEnum('room_type', ['bedroom', 'livingroom', 'kitchen', 'bathroom', 'study', 'corridor', 'custom'])
```

- [ ] **Step 2：重写现有 schema.ts 引入枚举并扩展字段**

修改 `apps/server/src/core/db/schema.ts`：

```typescript
// apps/server/src/core/db/schema.ts
import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import {
  alertSeverityEnum,
  alertStatusEnum,
  deviceStatusEnum,
  deviceTypeEnum,
  eventSourceEnum,
  genderEnum,
  kindEnum,
  patientStatusEnum,
  roleEnum,
  userStatusEnum,
} from './schema/enums'

// ─── users (扩展) ───
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).unique(),
  passwordHash: text('password_hash'),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  avatarUrl: text('avatar_url'),
  phone: varchar('phone', { length: 20 }).unique(),
  email: varchar('email', { length: 255 }).unique(),
  role: roleEnum('role').notNull().default('caregiver'),
  status: userStatusEnum('status').notNull().default('active'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── refresh_tokens (保留不变) ───
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('refresh_tokens_user_id_idx').on(t.userId),
    expiresIdx: index('refresh_tokens_expires_idx').on(t.expiresAt),
  }),
)

// ─── patients (扩展) ───
export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 100 }).notNull(),
  birthDate: date('birth_date'),
  gender: genderEnum('gender'),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  bloodType: text('blood_type'),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  emergencyContact: varchar('emergency_contact', { length: 100 }),
  emergencyPhone: varchar('emergency_phone', { length: 20 }),
  status: patientStatusEnum('status').notNull().default('active'),
  primaryDoctorId: uuid('primary_doctor_id').references(() => users.id, { onDelete: 'set null' }),
  tags: jsonb('tags').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── devices (扩展) ───
export const devices = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  serialNumber: varchar('serial_number', { length: 100 }).notNull().unique(),
  deviceType: deviceTypeEnum('device_type').notNull(),
  model: varchar('model', { length: 100 }),
  manufacturer: varchar('manufacturer', { length: 100 }),
  firmwareVersion: varchar('firmware_version', { length: 50 }),
  status: deviceStatusEnum('status').notNull().default('inactive'),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  roomId: uuid('room_id'), // FK to twin_rooms added after twin schema created
  config: jsonb('config').default({}).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  tags: jsonb('tags').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── events (扩展) ───
export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    kind: kindEnum('kind').notNull(),
    metric: varchar('metric', { length: 100 }).notNull(),
    value: doublePrecision('value'),
    unit: varchar('unit', { length: 50 }),
    confidence: real('confidence'),
    source: eventSourceEnum('source').default('manual'),
    severity: alertSeverityEnum('severity'),
    status: alertStatusEnum('status'),
    tags: jsonb('tags').default({}).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    patientMetricIdx: index('events_patient_metric_time_idx').on(t.patientId, t.metric, t.recordedAt.desc()),
    patientKindIdx: index('events_patient_kind_time_idx').on(t.patientId, t.kind, t.recordedAt.desc()),
    deviceTimeIdx: index('events_device_time_idx').on(t.deviceId, t.recordedAt.desc()),
    patientSourceIdx: index('events_patient_source_idx').on(t.patientId, t.source),
  }),
)

// ─── 系统表 (保留) ───
export const ingestRawData = pgTable('ingest_raw_data', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: varchar('source', { length: 50 }).notNull(),
  rawPayload: text('raw_payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('received'),
  error: text('error'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  resourceId: varchar('resource_id', { length: 50 }),
  details: jsonb('details').default({}),
  ip: varchar('ip', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// map_configs 表废弃，在 migration 中 DROP
```

注意：`devices.roomId` 字段的先使用 uuid 占位（不创建 FK），待 twin_rooms 表定义后再通过后续 migration 添加 FK 约束。

- [ ] **Step 3：提交**

```bash
git add apps/server/src/core/db/schema/enums.ts apps/server/src/core/db/schema.ts
git commit -m "feat(db): add enums file and extend existing tables for Phase 1 refactor"
```

---

### Task 2: 用户认证新增表

**文件**：
- 创建：`apps/server/src/core/db/schema/auth.ts`

新增 wechat_accounts、oauth_accounts、family_links、permissions、role_permissions 五张表。

- [ ] **Step 1：创建 auth.ts schema 文件**

```typescript
// apps/server/src/core/db/schema/auth.ts
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { roleEnum } from './enums'
import { users } from '../schema'
import { patients } from '../schema'

// 注意：patients 的引用需要在 patients 表定义之后才能工作
// 使用函数延迟引用解决模块加载顺序问题
const patientRef = () => patients

export const wechatAccounts = pgTable('wechat_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique().notNull(),
  openId: text('open_id').unique().notNull(),
  unionId: text('union_id'),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    providerEmail: text('provider_email'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex('oauth_provider_unique').on(t.provider, t.providerUserId),
  }),
)

export const familyLinks = pgTable(
  'family_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    familyUserId: uuid('family_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    relation: text('relation').notNull(),
    isPrimary: boolean('is_primary').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex('family_links_unique').on(t.familyUserId, t.patientId),
  }),
)

export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
})

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    role: roleEnum('role').notNull(),
    permissionCode: text('permission_code').references(() => permissions.code, { onDelete: 'cascade' }).notNull(),
  },
  (t) => ({
    unq: uniqueIndex('role_permissions_unique').on(t.role, t.permissionCode),
  }),
)
```

**注意**：`familyLinks` 引用了 `patients`，而 `patients` 在 `schema.ts` 中。可能在 schema.ts 的重构中 `patients` 会抽到独立文件。如果遇到循环引用，使用 Drizzle 的懒引用 `() => patients` 模式。

- [ ] **Step 2：提交**

```bash
git add apps/server/src/core/db/schema/auth.ts
git commit -m "feat(db): add auth group tables (wechat, oauth, family, permissions)"
```

---

### Task 3: 患者与健康档案新增表

**文件**：
- 创建：`apps/server/src/core/db/schema/patient.ts`

新增 patient_conditions、patient_allergies、patient_snapshots、patient_rooms 四张表。

- [ ] **Step 1：创建 patient.ts schema 文件**

```typescript
// apps/server/src/core/db/schema/patient.ts
import { date, integer, jsonb, pgTable, real, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { conditionStatusEnum, allergySeverityEnum, snapshotTypeEnum, roomTypeEnum } from './enums'
import { patients } from '../schema'

export const patientConditions = pgTable('patient_conditions', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  condition: text('condition').notNull(),
  diagnosisDate: date('diagnosis_date'),
  status: conditionStatusEnum('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const patientAllergies = pgTable('patient_allergies', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  allergen: text('allergen').notNull(),
  reaction: text('reaction'),
  severity: allergySeverityEnum('severity').notNull().default('moderate'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const patientSnapshots = pgTable('patient_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  snapshotType: snapshotTypeEnum('snapshot_type').notNull(),
  data: jsonb('data').notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const patientRooms = pgTable('patient_rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  roomName: text('room_name').notNull(),
  roomType: roomTypeEnum('room_type').notNull(),
  floor: text('floor'),
  areaSqm: real('area_sqm'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

- [ ] **Step 2：提交**

```bash
git add apps/server/src/core/db/schema/patient.ts
git commit -m "feat(db): add patient group tables (conditions, allergies, snapshots, rooms)"
```

---

### Task 4: 事件总线新增表

**文件**：
- 创建：`apps/server/src/core/db/schema/event.ts`

新增 cv_detections 表。

- [ ] **Step 1：创建 event.ts schema 文件**

```typescript
// apps/server/src/core/db/schema/event.ts
import { integer, jsonb, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { events } from '../schema'

export const cvDetections = pgTable('cv_detections', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).unique().notNull(),
  cameraId: text('camera_id').notNull(),
  detectedClass: text('detected_class').notNull(),
  bbox: jsonb('bbox').notNull(),
  roomName: text('room_name'),
  snapshotUrl: text('snapshot_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

- [ ] **Step 2：提交**

```bash
git add apps/server/src/core/db/schema/event.ts
git commit -m "feat(db): add cv_detections table"
```

---

### Task 5: 用药管理与预约随访新增表

**文件**：
- 创建：`apps/server/src/core/db/schema/medication.ts`
- 创建：`apps/server/src/core/db/schema/appointment.ts`

- [ ] **Step 1：创建 medication.ts**

```typescript
// apps/server/src/core/db/schema/medication.ts
import { boolean, date, index, integer, pgTable, text, time, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { medicationStatusEnum, medicationRouteEnum, adherenceStatusEnum, confirmationMethodEnum } from './enums'
import { patients, users } from '../schema'

export const medications = pgTable('medications', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  drugName: text('drug_name').notNull(),
  genericName: text('generic_name'),
  dosage: text('dosage').notNull(),
  dosageUnit: text('dosage_unit').notNull(),
  frequency: text('frequency').notNull(),
  route: medicationRouteEnum('route').notNull().default('oral'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  instructions: text('instructions'),
  status: medicationStatusEnum('status').notNull().default('active'),
  prescribedById: uuid('prescribed_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const medicationSchedules = pgTable('medication_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  medicationId: uuid('medication_id').references(() => medications.id, { onDelete: 'cascade' }).notNull(),
  scheduledTime: time('scheduled_time').notNull(),
  dayOfWeek: integer('day_of_week').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const medicationAdherence = pgTable(
  'medication_adherence',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scheduleId: uuid('schedule_id').references(() => medicationSchedules.id, { onDelete: 'cascade' }).notNull(),
    dueDate: date('due_date').notNull(),
    dueTime: time('due_time').notNull(),
    takenAt: timestamp('taken_at', { withTimezone: true }),
    status: adherenceStatusEnum('status').notNull().default('missed'),
    confirmedBy: confirmationMethodEnum('confirmed_by').default('unknown'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex('adherence_unique').on(t.scheduleId, t.dueDate, t.dueTime),
  }),
)
```

- [ ] **Step 2：创建 appointment.ts**

```typescript
// apps/server/src/core/db/schema/appointment.ts
import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { appointmentTypeEnum, appointmentStatusEnum, followupTypeEnum } from './enums'
import { patients, users } from '../schema'

export const appointments = pgTable('appointments', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'set null' }),
  appointmentType: appointmentTypeEnum('appointment_type').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').default(30),
  status: appointmentStatusEnum('status').notNull().default('scheduled'),
  reason: text('reason'),
  notes: text('notes'),
  location: text('location').default('居家'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const followupRecords = pgTable('followup_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  conductedById: uuid('conducted_by_id').references(() => users.id, { onDelete: 'set null' }),
  conductedAt: timestamp('conducted_at', { withTimezone: true }).defaultNow().notNull(),
  type: followupTypeEnum('type').notNull(),
  summary: text('summary'),
  vitalSigns: jsonb('vital_signs'),
  assessment: text('assessment'),
  nextFollowupAt: timestamp('next_followup_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

- [ ] **Step 3：提交**

```bash
git add apps/server/src/core/db/schema/medication.ts apps/server/src/core/db/schema/appointment.ts
git commit -m "feat(db): add medication and appointment tables"
```

---

### Task 6: 数字孪生核心表

**文件**：
- 创建：`apps/server/src/core/db/schema/twin.ts`

新增 8 张孪生相关表：twin_maps、twin_rooms、twin_entities、twin_actor_states、twin_behavior_rules、twin_activity_log、twin_nav_graph、twin_cv_detections。

- [ ] **Step 1：创建 twin.ts schema 文件**

完整代码参考规格文档 `docs/superpowers/specs/2026-05-14-comprehensive-refactor-design.md` 第 2.4.7 节。

关键点：
- `twin_maps.patientId` → FK 到 patients，unique
- `twin_rooms.mapId` → FK 到 twin_maps，cascade
- `twin_entities.mapId`/`roomId`/`deviceId`/`patientId` → 相应 FK
- `twin_actor_states.entityId` → FK 到 twin_entities，unique
- `twin_behavior_rules.patientId` → FK 到 patients
- `twin_activity_log.actorEntityId`/`fromRoomId`/`toRoomId` → 相应 FK
- `twin_nav_graph.mapId` → FK 到 twin_maps，unique
- `twin_cv_detections.patientId`/`mapId`/`inferredRoomId` → 相应 FK
- 所有 jsonb 字段使用 `default({})` 或 `default('[]')`
- 使用 `orientationEnum`、`entityCategoryEnum`、`actorPostureEnum`、`behaviorStateEnum`、`behaviorRuleTypeEnum`

```typescript
// apps/server/src/core/db/schema/twin.ts
import { boolean, index, integer, jsonb, pgTable, real, text, time, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { entityCategoryEnum, orientationEnum, actorPostureEnum, behaviorStateEnum, behaviorRuleTypeEnum, roomTypeEnum } from './enums'
import { patients, devices, users } from '../schema'
import { sql } from 'drizzle-orm'

export const twinMaps = pgTable('twin_maps', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).unique().notNull(),
  name: text('name').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  grid: jsonb('grid').notNull(),
  version: integer('version').default(1),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const twinRooms = pgTable('twin_rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  mapId: uuid('map_id').references(() => twinMaps.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  roomType: roomTypeEnum('room_type').notNull(),
  boundsX: integer('bounds_x').notNull(),
  boundsY: integer('bounds_y').notNull(),
  boundsW: integer('bounds_w').notNull(),
  boundsH: integer('bounds_h').notNull(),
  color: text('color'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const twinEntities = pgTable('twin_entities', {
  id: uuid('id').defaultRandom().primaryKey(),
  mapId: uuid('map_id').references(() => twinMaps.id, { onDelete: 'cascade' }).notNull(),
  roomId: uuid('room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  defId: text('def_id').notNull(),
  category: entityCategoryEnum('category').notNull(),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  orientation: orientationEnum('orientation').default('N'),
  layer: integer('layer').default(0),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  properties: jsonb('properties').default(sql`'{}'`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const twinActorStates = pgTable('twin_actor_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityId: uuid('entity_id').references(() => twinEntities.id, { onDelete: 'cascade' }).unique().notNull(),
  currentRoomId: uuid('current_room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  tileX: real('tile_x').notNull(),
  tileY: real('tile_y').notNull(),
  posture: actorPostureEnum('posture').default('standing'),
  behaviorState: behaviorStateEnum('behavior_state').default('idle'),
  activeInstruction: jsonb('active_instruction'),
  instructionQueue: jsonb('instruction_queue').default(sql`'[]'`),
  targetTileX: real('target_tile_x'),
  targetTileY: real('target_tile_y'),
  path: jsonb('path'),
  pathProgress: real('path_progress').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const twinBehaviorRules = pgTable('twin_behavior_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  ruleType: behaviorRuleTypeEnum('rule_type').notNull(),
  name: text('name').notNull(),
  triggerTime: time('trigger_time'),
  triggerCondition: jsonb('trigger_condition'),
  actions: jsonb('actions').notNull(),
  priority: integer('priority').default(0),
  isEnabled: boolean('is_enabled').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const twinActivityLog = pgTable('twin_activity_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorEntityId: uuid('actor_entity_id').references(() => twinEntities.id, { onDelete: 'cascade' }).notNull(),
  action: text('action').notNull(),
  fromRoomId: uuid('from_room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  toRoomId: uuid('to_room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  durationMs: integer('duration_ms'),
  metadata: jsonb('metadata').default(sql`'{}'`),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
})

export const twinNavGraph = pgTable('twin_nav_graph', {
  id: uuid('id').defaultRandom().primaryKey(),
  mapId: uuid('map_id').references(() => twinMaps.id, { onDelete: 'cascade' }).unique().notNull(),
  graphData: jsonb('graph_data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const twinCvDetections = pgTable('twin_cv_detections', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  mapId: uuid('map_id').references(() => twinMaps.id, { onDelete: 'cascade' }).notNull(),
  cameraId: text('camera_id').notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
  detectedClass: text('detected_class').notNull(),
  confidence: real('confidence').notNull(),
  bbox: jsonb('bbox').notNull(),
  inferredRoomId: uuid('inferred_room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  synced: boolean('synced').default(false),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

- [ ] **Step 2：提交**

```bash
git add apps/server/src/core/db/schema/twin.ts
git commit -m "feat(db): add digital twin tables (maps, rooms, entities, actors, behaviors)"
```

---

### Task 7: Schema barrel export + 迁移生成

**文件**：
- 修改：`apps/server/src/core/db/index.ts`（更新 schema 导出来源）
- 生成：`apps/server/drizzle/0002_*.sql`（自动生成）

- [ ] **Step 1：更新 db/index.ts 统一导出**

读取当前 `apps/server/src/core/db/index.ts`，将所有 schema 导出集中：

```typescript
// apps/server/src/core/db/index.ts
import { drizzle } from 'drizzle-orm/postgres'
import postgres from 'postgres'
import { env } from '../../env'

const client = postgres(env.DATABASE_URL, { max: 10 })
export const db = drizzle(client)

// Re-export all schemas from barrel
export * from './schema'
export * from './schema/enums'
export * from './schema/auth'
export * from './schema/patient'
export * from './schema/event'
export * from './schema/medication'
export * from './schema/appointment'
export * from './schema/twin'
```

- [ ] **Step 2：检查 drizzle.config.ts 确认 schema 路径**

确认 `apps/server/drizzle.config.ts` 的 schema 路径指向正确的文件。

```bash
type apps/server/drizzle.config.ts
```

预期：schema 配置应为 `./src/core/db/schema.ts` 或通配符 `./src/core/db/schema/**/*.ts`。

如果当前配置指向单个文件，改为通配符以包含所有新 schema 文件：
```typescript
// drizzle.config.ts
schema: './src/core/db/schema/**/*.ts',
```

- [ ] **Step 3：生成迁移 SQL**

```bash
Set-Location apps/server; if ($?) { pnpm db:generate }
```

- [ ] **Step 4：审查生成的迁移**

```bash
type apps/server/drizzle/0002_*.sql
```

检查：
- 新枚举 CREATE TYPE（user_status, gender, blood_type, condition_status, ...）
- 旧枚举 ALTER TYPE ADD VALUE（role 新增 patient/family，device_status 新增 error，patient_status 新增 archived 等）
- 旧表 ALTER TABLE ADD COLUMN（users 新增 avatar_url/phone/email/status/last_login_at/updated_at 等）
- map_configs DROP TABLE
- 新表 CREATE TABLE（全部 23 张新表）
- FK constraints + indexes

- [ ] **Step 5：提交**

```bash
git add apps/server/src/core/db/index.ts apps/server/drizzle.config.ts apps/server/drizzle/
git commit -m "feat(db): add schema barrel export and generate migration"
```

---

### Task 8: 更新 shared-types Zod Schemas

**文件**：
- 新增/修改：`packages/shared-types/src/schemas/` 下的文件

新增用药、预约、孪生相关的 Zod schema 定义，供前后端共享类型。

- [ ] **Step 1：新增 medication schema**

创建 `packages/shared-types/src/schemas/medication.ts`：

```typescript
import { z } from 'zod'

export const medicationCreateSchema = z.object({
  patientId: z.string().uuid(),
  drugName: z.string().min(1),
  genericName: z.string().optional(),
  dosage: z.string().min(1),
  dosageUnit: z.string().min(1),
  frequency: z.string().min(1),
  route: z.enum(['oral', 'injection', 'topical', 'inhalation', 'other']).default('oral'),
  startDate: z.string(),
  endDate: z.string().optional(),
  instructions: z.string().optional(),
  status: z.enum(['active', 'completed', 'paused', 'cancelled']).default('active'),
})

export const medicationUpdateSchema = medicationCreateSchema.partial().extend({
  id: z.string().uuid(),
})

export const medicationScheduleSchema = z.object({
  medicationId: z.string().uuid(),
  scheduledTime: z.string(), // '08:00'
  dayOfWeek: z.array(z.number().min(1).max(7)).optional(),
})

export const medicationAdherenceSchema = z.object({
  scheduleId: z.string().uuid(),
  dueDate: z.string(),
  dueTime: z.string(),
  status: z.enum(['taken', 'missed', 'skipped', 'delayed']).default('missed'),
  confirmedBy: z.enum(['self', 'family', 'auto', 'unknown']).default('unknown'),
  notes: z.string().optional(),
})
```

- [ ] **Step 2：新增 appointment schema**

创建 `packages/shared-types/src/schemas/appointment.ts`：

```typescript
import { z } from 'zod'

export const appointmentCreateSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid().optional(),
  appointmentType: z.enum(['checkup', 'followup', 'emergency', 'consultation', 'rehabilitation']),
  scheduledAt: z.string(),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  reason: z.string().optional(),
  notes: z.string().optional(),
  location: z.string().default('居家'),
})

export const appointmentUpdateSchema = appointmentCreateSchema.partial().extend({
  id: z.string().uuid(),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
})

export const followupCreateSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  type: z.enum(['phone', 'video', 'home_visit', 'clinic', 'message']),
  summary: z.string().optional(),
  vitalSigns: z.record(z.any()).optional(),
  assessment: z.string().optional(),
  nextFollowupAt: z.string().optional(),
})
```

- [ ] **Step 3：新增 twin schema**

创建 `packages/shared-types/src/schemas/twin.ts`：

```typescript
import { z } from 'zod'

export const mapCreateSchema = z.object({
  patientId: z.string().uuid(),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  grid: z.array(z.array(z.any())),
})

export const roomCreateSchema = z.object({
  mapId: z.string().uuid(),
  name: z.string().min(1),
  roomType: z.enum(['bedroom', 'livingroom', 'kitchen', 'bathroom', 'study', 'corridor', 'custom']),
  boundsX: z.number().int(),
  boundsY: z.number().int(),
  boundsW: z.number().int().positive(),
  boundsH: z.number().int().positive(),
  color: z.string().optional(),
})

export const entityCreateSchema = z.object({
  mapId: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  defId: z.string().min(1),
  category: z.enum(['furniture', 'structure', 'sensor', 'actor', 'marker']),
  gridX: z.number().int(),
  gridY: z.number().int(),
  orientation: z.enum(['N', 'S', 'E', 'W']).default('N'),
  layer: z.number().int().default(0),
  deviceId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
})

export const instructionSchema = z.object({
  actorEntityId: z.string().uuid(),
  type: z.enum(['move_to', 'move_to_room', 'use_object', 'stay', 'change_posture', 'idle']),
  params: z.record(z.any()),
  priority: z.number().int().default(0),
  preemptible: z.boolean().default(true),
})

export const behaviorRuleCreateSchema = z.object({
  patientId: z.string().uuid(),
  ruleType: z.enum(['schedule', 'trigger', 'routine']),
  name: z.string().min(1),
  triggerTime: z.string().optional(),
  triggerCondition: z.record(z.any()).optional(),
  actions: z.array(z.any()),
  priority: z.number().int().default(0),
  isEnabled: z.boolean().default(true),
})
```

- [ ] **Step 4：更新 schemas/index.ts 导出**

```
# 在 packages/shared-types/src/schemas/index.ts 中添加新的导出行
export * from './medication'
export * from './appointment'
export * from './twin'
```

- [ ] **Step 5：更新 auth schema（微信登录支持）**

在 `packages/shared-types/src/schemas/auth.ts` 中添加：

```typescript
export const wechatLoginSchema = z.object({
  code: z.string().min(1),
  nickname: z.string().optional(),
  avatarUrl: z.string().optional(),
})
```

- [ ] **Step 6：验证类型编译**

```bash
Set-Location apps/server; if ($?) { pnpm typecheck }
Set-Location packages/shared-types; if ($?) { pnpm typecheck }
```

- [ ] **Step 7：提交**

```bash
git add packages/shared-types/src/schemas/
git commit -m "feat(shared-types): add medication, appointment, twin, and wechat login Zod schemas"
```

---

### Task 9: 环境变量扩展（微信配置）

**文件**：
- 修改：`apps/server/src/env.ts`

添加微信小程序登录所需的环境变量。

- [ ] **Step 1：更新 env.ts**

```typescript
// 在 envSchema 中添加：
WECHAT_APP_ID: z.string().optional(),
WECHAT_APP_SECRET: z.string().optional(),
```

- [ ] **Step 2：更新 .env.example 和 .env**

```
# 在 .env.example 末尾追加：
WECHAT_APP_ID=
WECHAT_APP_SECRET=
```

- [ ] **Step 3：提交**

```bash
git add apps/server/src/env.ts .env.example
git commit -m "feat(config): add WeChat mini-program env vars"
```

---

### Task 10: 完整性验证

- [ ] **Step 1：运行 typecheck**

```bash
Set-Location .; if ($?) { pnpm typecheck }
```

- [ ] **Step 2：运行 lint**

```bash
Set-Location .; if ($?) { pnpm lint }
```

- [ ] **Step 3：确认迁移未执行时无运行时错误**

```bash
Set-Location apps/server; if ($?) { pnpm dev }
```

预期：服务启动，bootstrap 执行（demo 账户 / 默认地图 / ward 可能因旧字段失败）。

- [ ] **Step 4：运行迁移**

```bash
Set-Location apps/server; if ($?) { pnpm db:migrate }
```

- [ ] **Step 5：验证数据库表**

```bash
docker compose exec postgres psql -U postgres -d iomtea -c "\dt"
```

预期输出：应有 29 张表（user 相关 6、patient 相关 5、device 1、event 2、medication 3、appointment 2、twin 8、system 2 审计/原始数据）。

---

### 自检清单

- [ ] 所有新枚举与规格一致
- [ ] 所有表 FK 约束正确
- [ ] events.device_id 改为 nullable（DEFAULT set null）
- [ ] map_configs 表已废弃（DROP TABLE 在迁移中）
- [ ] shared-types 新增 schemas 已导出
- [ ] typecheck 通过
- [ ] lint 通过
- [ ] 迁移 SQL 手工审查通过
