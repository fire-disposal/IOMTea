# IOMTea 全局重构设计规格

> **日期**: 2026-05-14
> **范围**: 后端数据库、后端架构、前端品牌统一、数字孪生引擎、跨系统耦合
> **推进策略**: 方案 A — 分层渐进（DB → API → 前端 → 孪生引擎 → 系统耦合）
> **遵循**: ARCHITECTURE.md DDD-Lite 规范, 无类/无接口抽象/函数式优先

---

## 目录

1. [总体架构愿景](#1-总体架构愿景)
2. [Phase 1: 数据库 Schema 重构](#2-phase-1-数据库-schema-重构)
3. [Phase 2: 后端 API 架构](#3-phase-2-后端-api-架构)
4. [Phase 3: 前端品牌统一](#4-phase-3-前端品牌统一)
5. [Phase 4: 数字孪生引擎](#5-phase-4-数字孪生引擎)
6. [Phase 5: 跨系统耦合](#6-phase-5-跨系统耦合)
7. [DB Schema 总览](#7-db-schema-总览)

---

## 1. 总体架构愿景

### 1.1 系统全景

```
┌─────────────────────────────────────────────────────┐
│                    前端展示层                         │
│  React Web (管理后台+3D孪生)     Taro (患者/家属小程序) │
│  Flutter (实验工具面板, 维持现状)                      │
├─────────────────────────────────────────────────────┤
│                  tRPC + WebSocket                    │
├────────────────────┬──────────────┬─────────────────┤
│   core (业务)       │  twin (孪生)  │  ingest (接入)  │
│   auth/patient/     │  engine/     │  mqtt/tcp/     │
│   device/medication/│  pathfinding/│  cv-bridge/    │
│   appointment/ehr   │  behavior/   │                │
├────────────────────┴──────────────┴─────────────────┤
│                events 表 (Domain Event Bus)           │
├─────────────────────────────────────────────────────┤
│              PostgreSQL 16 + Drizzle ORM             │
└─────────────────────────────────────────────────────┘
```

### 1.2 三端分工

| 端 | 定位 | 核心职责 |
|----|------|---------|
| **React Web** | 管理后台 + 3D 孪生主界面 | 医护管理、地图编辑、3D/2D 孪生监控、数据分析 |
| **Taro 小程序** | 患者/家属端 | 扫码绑定、健康数据查看、用药提醒、孪生简版视图 |
| **Flutter** | 实验工具 | MQTT/YOLO/IMU/BLE 调试面板（维持现状，不加码） |

### 1.3 新增 Bounded Context

在现有 3 个 Context（core / simulator / ingest）基础上新增 **twin**：

```
apps/server/src/
├── core/          ← 核心业务（auth, patient, device, medication, appointment）
├── simulator/     ← 生理仿真（保留并增强）
├── ingest/        ← 数据接入（mqtt, tcp, cv-bridge）
├── twin/          ← 数字孪生引擎（新增）
└── events/        ← Domain Event 共享层
```

### 1.4 推进顺序

| Phase | 内容 | 预计产出 |
|-------|------|---------|
| 1 | DB Schema 29 表完整设计 + Drizzle 迁移 | 迁移 SQL 文件 |
| 2 | 后端 API（新路由器 + 微信登录 + RBAC + 业务服务） | tRPC 路由 + Service 函数 |
| 3 | 三端品牌主题统一（抹茶绿 + 组件库对齐） | 主题配置 + UI 重构 |
| 4 | 孪生引擎重构（指令接口 + 寻路 + 行为引擎） | 独立引擎模块 |
| 5 | 孪生与业务耦合（CV 定位/虚实同步/事件总线） | 集成桥接层 |

---

## 2. Phase 1: 数据库 Schema 重构

### 2.1 设计原则

- **窄表优先**：jsonb 用于自由扩展，结构化字段用于查询和索引
- **枚举类型**：PostgreSQL 原生 enum，Drizzle 管理
- **软删除**：仅对关键业务表使用 status 字段，不设 deleted_at
- **时间戳**：所有表包含 created_at / updated_at（触发器 or Drizzle defaultNow）
- **外键策略**：级联删除仅在明确从属关系中使用，其余用 RESTRICT

### 2.2 表分组

共 **29 张表**，按业务模块分为 7 组：

| 分组 | 表数 | 表名 |
|------|------|------|
| 用户与认证 | 6 | users, wechat_accounts, oauth_accounts, family_links, permissions, role_permissions |
| 患者与健康档案 | 5 | patients, patient_conditions, patient_allergies, patient_snapshots, patient_rooms |
| 设备 | 1 | devices |
| 事件总线 | 2 | events, cv_detections |
| 用药管理 | 3 | medications, medication_schedules, medication_adherence |
| 预约随访 | 2 | appointments, followup_records |
| 数字孪生 | 8 | twin_maps, twin_rooms, twin_entities, twin_actor_states, twin_behavior_rules, twin_activity_log, twin_nav_graph, twin_cv_detections |
| 系统 | 2 | audit_logs, ingest_raw_data（保留现有） |

### 2.3 枚举定义

```sql
-- 用户相关
CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'nurse', 'caregiver', 'patient', 'family');
CREATE TYPE user_status AS ENUM ('active', 'disabled', 'pending');
CREATE TYPE gender AS ENUM ('male', 'female', 'other');
CREATE TYPE blood_type AS ENUM ('A', 'B', 'AB', 'O');

-- 患者相关
CREATE TYPE patient_status AS ENUM ('active', 'discharged', 'archived');
CREATE TYPE condition_status AS ENUM ('active', 'resolved', 'managed');
CREATE TYPE allergy_severity AS ENUM ('mild', 'moderate', 'severe');
CREATE TYPE snapshot_type AS ENUM ('daily', 'weekly', 'monthly', 'discharge');

-- 设备相关
CREATE TYPE device_type AS ENUM ('mattress', 'vision', 'imu', 'generic', 'simulator', 'custom');
CREATE TYPE device_status AS ENUM ('active', 'inactive', 'maintenance', 'error');

-- 事件相关
CREATE TYPE event_kind AS ENUM ('observation', 'alert', 'behavior', 'location');
CREATE TYPE event_source AS ENUM ('iot', 'cv', 'simulator', 'manual');
CREATE TYPE alert_severity AS ENUM ('critical', 'warning', 'info');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'expired');

-- 用药相关
CREATE TYPE medication_status AS ENUM ('active', 'completed', 'paused', 'cancelled');
CREATE TYPE medication_route AS ENUM ('oral', 'injection', 'topical', 'inhalation', 'other');
CREATE TYPE adherence_status AS ENUM ('taken', 'missed', 'skipped', 'delayed');
CREATE TYPE confirmation_method AS ENUM ('self', 'family', 'auto', 'unknown');

-- 预约相关
CREATE TYPE appointment_type AS ENUM ('checkup', 'followup', 'emergency', 'consultation', 'rehabilitation');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE followup_type AS ENUM ('phone', 'video', 'home_visit', 'clinic', 'message');

-- 孪生相关
CREATE TYPE entity_category AS ENUM ('furniture', 'structure', 'sensor', 'actor', 'marker');
CREATE TYPE orientation AS ENUM ('N', 'S', 'E', 'W');
CREATE TYPE actor_posture AS ENUM ('lying', 'sitting', 'standing', 'walking');
CREATE TYPE behavior_state AS ENUM ('idle', 'moving', 'acting', 'sleeping', 'eating', 'toilet', 'shower');
CREATE TYPE behavior_rule_type AS ENUM ('schedule', 'trigger', 'routine');
CREATE TYPE room_type AS ENUM ('bedroom', 'livingroom', 'kitchen', 'bathroom', 'study', 'corridor', 'custom');
```

### 2.4 表详细设计

#### 2.4.1 用户与认证

```typescript
// users — 核心用户表
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique(),           // 保留，备用登录
  passwordHash: text('password_hash'),           // 微信登录用户可为 null
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  phone: text('phone').unique(),
  email: text('email').unique(),
  role: userRole('role').notNull().default('caregiver'),
  status: userStatus('status').notNull().default('active'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// wechat_accounts — 微信登录关联（1:1 用户）
export const wechatAccounts = pgTable('wechat_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique().notNull(),
  openId: text('open_id').unique().notNull(),
  unionId: text('union_id'),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// oauth_accounts — OAuth 预留表（Phase 1 建表，代码 Phase 2+）
export const oauthAccounts = pgTable('oauth_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  provider: text('provider').notNull(),
  providerUserId: text('provider_user_id').notNull(),
  providerEmail: text('provider_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  unq: uniqueIndex().on(t.provider, t.providerUserId),
}));

// family_links — 家属患者关联
export const familyLinks = pgTable('family_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  familyUserId: uuid('family_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  relation: text('relation').notNull(),     // spouse, child, parent, sibling, other
  isPrimary: boolean('is_primary').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  unq: uniqueIndex().on(t.familyUserId, t.patientId),
}));

// permissions — 权限定义
export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),    // patient:read, device:write, twin:manage
  name: text('name').notNull(),
  resource: text('resource').notNull(),     // patient, device, ward, twin
  action: text('action').notNull(),         // read, write, delete, manage
});

// role_permissions — 角色权限关联
export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: userRole('role').notNull(),
  permissionCode: text('permission_code').references(() => permissions.code, { onDelete: 'cascade' }).notNull(),
}, (t) => ({
  unq: uniqueIndex().on(t.role, t.permissionCode),
}));
```

#### 2.4.2 患者与健康档案

```typescript
// patients — 增强患者表
export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  birthDate: date('birth_date'),
  gender: gender('gender'),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  bloodType: bloodType('blood_type'),
  phone: text('phone'),
  address: text('address'),                    // 家庭地址（居家场景核心）
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),
  status: patientStatus('status').notNull().default('active'),
  primaryDoctorId: uuid('primary_doctor_id').references(() => users.id, { onDelete: 'set null' }),
  tags: jsonb('tags').default(sql`'{}'`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// patient_conditions — 既往病史
export const patientConditions = pgTable('patient_conditions', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  condition: text('condition').notNull(),        // hypertension, diabetes_type2, etc.
  diagnosisDate: date('diagnosis_date'),
  status: conditionStatus('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// patient_allergies — 过敏信息
export const patientAllergies = pgTable('patient_allergies', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  allergen: text('allergen').notNull(),           // penicillin, peanut, etc.
  reaction: text('reaction'),                     // rash, anaphylaxis, etc.
  severity: allergySeverity('severity').notNull().default('moderate'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// patient_snapshots — 定期健康数据快照（聚合后存储，减轻 events 查询压力）
export const patientSnapshots = pgTable('patient_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  snapshotType: snapshotType('snapshot_type').notNull(),
  data: jsonb('data').notNull(),                  // { avg_hr, avg_bp, min_spO2, ... }
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// patient_rooms — 患者房间分区（孪生地图的桥梁）
export const patientRooms = pgTable('patient_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  roomName: text('room_name').notNull(),
  roomType: roomType('room_type').notNull(),
  floor: text('floor'),
  areaSqm: real('area_sqm'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

#### 2.4.3 设备

```typescript
// devices — 增强设备表
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  serialNumber: text('serial_number').unique().notNull(),
  deviceType: deviceType('device_type').notNull(),
  model: text('model'),
  manufacturer: text('manufacturer'),
  firmwareVersion: text('firmware_version'),
  status: deviceStatus('status').notNull().default('inactive'),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  roomId: uuid('room_id').references(() => twinRooms.id, { onDelete: 'set null' }),  // 绑定孪生房间
  config: jsonb('config').default(sql`'{}'`),
  lastSeenAt: timestamp('last_seen_at'),
  tags: jsonb('tags').default(sql`'{}'`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

#### 2.4.4 事件总线

```typescript
// events — 增强事件表（核心数据总线）
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
  kind: eventKind('kind').notNull(),
  metric: text('metric').notNull(),
  value: real('value'),
  unit: text('unit'),
  confidence: real('confidence'),               // 数据置信度（CV 检测必备）
  source: eventSource('source').default('manual'),
  severity: alertSeverity('severity'),
  status: alertStatus('status'),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  tags: jsonb('tags').default(sql`'{}'`),
}, (t) => ({
  // 保留现有索引
  idxPatientMetricTime: index().on(t.patientId, t.metric, t.recordedAt.desc()),
  idxPatientKindTime: index().on(t.patientId, t.kind, t.recordedAt.desc()),
  idxDeviceTime: index().on(t.deviceId, t.recordedAt.desc()),
  // 新增索引
  idxPatientSource: index().on(t.patientId, t.source),
}));

// cv_detections — CV 检测结果（结构化存储，补充 events 的 jsonb 字段）
export const cvDetections = pgTable('cv_detections', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).unique().notNull(),
  cameraId: text('camera_id').notNull(),
  detectedClass: text('detected_class').notNull(),    // person, pet, fall, etc.
  bbox: jsonb('bbox').notNull(),                      // { x, y, w, h }
  roomName: text('room_name'),                        // 检测到的房间
  snapshotUrl: text('snapshot_url'),                  // 抓图路径
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

#### 2.4.5 用药管理

```typescript
// medications — 药物处方
export const medications = pgTable('medications', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  drugName: text('drug_name').notNull(),
  genericName: text('generic_name'),
  dosage: text('dosage').notNull(),                    // '5mg', '10ml'
  dosageUnit: text('dosage_unit').notNull(),           // '片', 'ml', '粒'
  frequency: text('frequency').notNull(),              // '每日三次', 'tid'
  route: medicationRoute('route').notNull().default('oral'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  instructions: text('instructions'),
  status: medicationStatus('status').notNull().default('active'),
  prescribedById: uuid('prescribed_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// medication_schedules — 服药时刻
export const medicationSchedules = pgTable('medication_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  medicationId: uuid('medication_id').references(() => medications.id, { onDelete: 'cascade' }).notNull(),
  scheduledTime: time('scheduled_time').notNull(),     // '08:00'
  dayOfWeek: integer('day_of_week').array(),           // [1,2,3,4,5,6,7] or null = every day
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// medication_adherence — 服药依从记录
export const medicationAdherence = pgTable('medication_adherence', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduleId: uuid('schedule_id').references(() => medicationSchedules.id, { onDelete: 'cascade' }).notNull(),
  dueDate: date('due_date').notNull(),
  dueTime: time('due_time').notNull(),
  takenAt: timestamp('taken_at'),
  status: adherenceStatus('status').notNull().default('missed'),
  confirmedBy: confirmationMethod('confirmed_by').default('unknown'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  unq: uniqueIndex().on(t.scheduleId, t.dueDate, t.dueTime),
}));
```

#### 2.4.6 预约与随访

```typescript
// appointments — 预约记录
export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'set null' }),
  appointmentType: appointmentType('appointment_type').notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  durationMinutes: integer('duration_minutes').default(30),
  status: appointmentStatus('status').notNull().default('scheduled'),
  reason: text('reason'),
  notes: text('notes'),
  location: text('location').default('居家'),          // '线上', 'XX医院', '居家'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// followup_records — 随访记录
export const followupRecords = pgTable('followup_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  conductedById: uuid('conducted_by_id').references(() => users.id, { onDelete: 'set null' }),
  conductedAt: timestamp('conducted_at').defaultNow().notNull(),
  type: followupType('type').notNull(),
  summary: text('summary'),
  vitalSigns: jsonb('vital_signs'),                    // { hr, bp, spO2, temp, ... }
  assessment: text('assessment'),
  nextFollowupAt: timestamp('next_followup_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

#### 2.4.7 数字孪生

```typescript
// twin_maps — 地图定义（1患者1地图）
export const twinMaps = pgTable('twin_maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).unique().notNull(),
  name: text('name').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  grid: jsonb('grid').notNull(),                       // Tile[][] — 瓦片数据
  version: integer('version').default(1),              // 乐观锁版本号
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// twin_rooms — 房间分区（结构化索引，区别于 grid jsonb）
export const twinRooms = pgTable('twin_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  mapId: uuid('map_id').references(() => twinMaps.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  roomType: roomType('room_type').notNull(),
  boundsX: integer('bounds_x').notNull(),
  boundsY: integer('bounds_y').notNull(),
  boundsW: integer('bounds_w').notNull(),
  boundsH: integer('bounds_h').notNull(),
  color: text('color'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// twin_entities — 地图上的实体（家具/设备/虚拟人）
export const twinEntities = pgTable('twin_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  mapId: uuid('map_id').references(() => twinMaps.id, { onDelete: 'cascade' }).notNull(),
  roomId: uuid('room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  defId: text('def_id').notNull(),                    // bed, table, sofa, person, ...
  category: entityCategory('category').notNull(),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  orientation: orientation('orientation').default('N'),
  layer: integer('layer').default(0),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  properties: jsonb('properties').default(sql`'{}'`),  // { width, height, isPassable, ... }
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// twin_actor_states — 虚拟人运行时状态
export const twinActorStates = pgTable('twin_actor_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').references(() => twinEntities.id, { onDelete: 'cascade' }).unique().notNull(),
  currentRoomId: uuid('current_room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  tileX: real('tile_x').notNull(),
  tileY: real('tile_y').notNull(),
  posture: actorPosture('posture').default('standing'),
  behaviorState: behaviorState('behavior_state').default('idle'),
  activeInstruction: jsonb('active_instruction'),       // { type, target, params, priority }
  instructionQueue: jsonb('instruction_queue').default(sql`'[]'`),
  targetTileX: real('target_tile_x'),
  targetTileY: real('target_tile_y'),
  path: jsonb('path'),                                  // [{ x, y }, ...]
  pathProgress: real('path_progress').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// twin_behavior_rules — 行为规则（作息/触发/常规）
export const twinBehaviorRules = pgTable('twin_behavior_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  ruleType: behaviorRuleType('rule_type').notNull(),
  name: text('name').notNull(),
  triggerTime: time('trigger_time'),                    // 定时触发 eg. '07:00'
  triggerCondition: jsonb('trigger_condition'),          // { sensor, operator, threshold }
  actions: jsonb('actions').notNull(),                   // [{ type:'move_to', room:'kitchen' }, ...]
  priority: integer('priority').default(0),              // 数字越小优先级越高
  isEnabled: boolean('is_enabled').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// twin_activity_log — 虚拟人活动历史
export const twinActivityLog = pgTable('twin_activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorEntityId: uuid('actor_entity_id').references(() => twinEntities.id, { onDelete: 'cascade' }).notNull(),
  action: text('action').notNull(),                     // moved, entered_room, fell_asleep, ...
  fromRoomId: uuid('from_room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  toRoomId: uuid('to_room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  durationMs: integer('duration_ms'),
  metadata: jsonb('metadata').default(sql`'{}'`),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
});

// twin_nav_graph — 导航网格缓存（加速寻路）
export const twinNavGraph = pgTable('twin_nav_graph', {
  id: uuid('id').primaryKey().defaultRandom(),
  mapId: uuid('map_id').references(() => twinMaps.id, { onDelete: 'cascade' }).unique().notNull(),
  graphData: jsonb('graph_data').notNull(),              // NavMesh 连通图预计算数据
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// twin_cv_detections — CV 检测与孪生关联
export const twinCvDetections = pgTable('twin_cv_detections', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  mapId: uuid('map_id').references(() => twinMaps.id, { onDelete: 'cascade' }).notNull(),
  cameraId: text('camera_id').notNull(),
  detectedAt: timestamp('detected_at').notNull(),
  detectedClass: text('detected_class').notNull(),
  confidence: real('confidence').notNull(),
  bbox: jsonb('bbox').notNull(),
  inferredRoomId: uuid('inferred_room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  synced: boolean('synced').default(false),             // 是否已同步到孪生引擎
  syncedAt: timestamp('synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

#### 2.4.8 系统表（保留现有 + 微调）

```typescript
// audit_logs — 保留现有结构，增加 nullable target_type
// ingest_raw_data — 保留现有结构不改

// 废弃 map_configs 表，功能由 twin_maps 替代
// 可通过迁移数据后删除
```

---

## 3. Phase 2: 后端 API 架构

### 3.1 Context 重新划分

```
apps/server/src/
├── core/                    ← 核心业务
│   ├── db/
│   │   └── schema.ts            完整 Schema（所有表定义集中管理）
│   ├── lib/                     工具函数（jwt, password, wechat）
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   └── wechat.ts           NEW: code2session, 微信 API 封装
│   ├── services/                业务逻辑
│   │   ├── auth.ts              register/login/wechatLogin/refresh
│   │   ├── patient.ts           CRUD + conditions/allergies/rooms
│   │   ├── device.ts            CRUD + binding
│   │   ├── medication.ts        CRUD + schedules + adherence
│   │   ├── appointment.ts       CRUD + followup
│   │   ├── alert.ts             list/ack/resolve
│   │   └── dashboard.ts         enhanced summary
│   └── trpc/                    tRPC 路由（薄层）
│       ├── context.ts           增强 context: db + user + permissions
│       ├── middleware/
│       │   ├── auth.ts          JWT + WeChat token 验证
│       │   └── rbac.ts          NEW: 权限检查
│       ├── _app.ts              路由注册
│       ├── auth.router.ts
│       ├── patient.router.ts
│       ├── device.router.ts
│       ├── data.router.ts
│       ├── alert.router.ts
│       ├── alertRule.router.ts
│       ├── medication.router.ts
│       ├── appointment.router.ts
│       └── dashboard.router.ts
│
├── twin/                    ← 数字孪生引擎（新增）
│   ├── engine.ts               引擎主入口（Ward 管理）
│   ├── pathfinding.ts          A* + 门感知寻路
│   ├── nav-mesh.ts             导航网格生成
│   ├── behavior.ts             行为状态机
│   ├── instruction.ts          指令接口与队列
│   ├── activity-logger.ts      活动日志写入
│   ├── scheduler.ts            作息调度器
│   ├── db-writer.ts            twin 相关 DB 写入
│   └── trpc/                   tRPC 路由
│       └── twin.router.ts      map/entity/actor/behavior CRUD + 控制
│
├── simulator/               ← 生理仿真（保留，增强与 twin 互动）
│   ├── engine.ts
│   ├── clock.ts
│   ├── factory.ts
│   ├── profiles/
│   ├── physiology/
│   ├── scenarios/
│   ├── db-writer.ts
│   └── trpc/
│       └── simulator.router.ts
│
├── ingest/                  ← 数据接入
│   ├── mqtt/
│   ├── tcp/
│   ├── cv-bridge/            NEW: CV 检测数据桥接
│   │   └── index.ts          CV 原始检测 → events + twin 同步
│   └── trpc/
│
└── events/                  ← Domain Event 共享层
    └── （events 表即总线）
```

### 3.2 微信登录流程

```
小程序端                    Server 端                    微信服务端
   │                          │                             │
   ├─ wx.login() 获取 code ──▶│                             │
   │                          ├─ /trpc/auth.wechatLogin ──▶│
   │                          │   code2session(code)        │
   │                          │◀── openid, unionid ────────│
   │                          │                             │
   │                          ├─ 查找 wechat_accounts       │
   │                          │   ├─ 命中: 生成 JWT, 返回   │
   │                          │   └─ 未命中: 创建 user +    │
   │                          │      wechat_account, 返回   │
   │                          │                             │
   │◀── tokenPair ───────────│                             │
   │                          │                             │
```

**service 函数签名**：

```typescript
// core/services/auth.ts

export async function wechatLogin(
  db: DrizzleClient,
  code: string,
  appId: string,
  appSecret: string,
): Promise<{ tokens: TokenPair; isNewUser: boolean }>

export async function register(
  db: DrizzleClient,
  input: { username: string; password: string; displayName: string; role: UserRole },
): Promise<TokenPair>

export async function login(
  db: DrizzleClient,
  input: { username: string; password: string },
): Promise<TokenPair>
```

**tRPC 路由**：

```typescript
// core/trpc/auth.router.ts

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(...),
  login: publicProcedure.input(loginSchema).mutation(...),
  wechatLogin: publicProcedure.input(wechatLoginSchema).mutation(...),
  refresh: publicProcedure.input(refreshSchema).mutation(...),
})
```

### 3.3 RBAC 权限模型

使用最简单的 **Code-Based RBAC**：

```
permissions 表定义权限码:
  patient:read      - 查看患者
  patient:write     - 编辑患者
  patient:delete    - 删除患者
  device:read       - 查看设备
  device:write      - 编辑设备
  device:manage     - 管理设备（配对/解绑）
  twin:read         - 查看孪生
  twin:manage       - 管理孪生（编辑地图/控制引擎）
  alert:read        - 查看告警
  alert:manage      - 确认/解决告警
  medication:read   - 查看用药
  medication:write  - 开药/编辑用药
  appointment:read  - 查看预约
  appointment:write - 创建/编辑预约
  dashboard:view    - 查看仪表盘
  admin:settings    - 系统设置

role_permissions 表预置映射:
  admin:    [全部]
  doctor:   [patient:*, device:*, alert:*, medication:*, appointment:*, twin:*, dashboard:view]
  nurse:    [patient:read, device:read, alert:*, medication:read, appointment:read, twin:read, dashboard:view]
  caregiver:[patient:read, alert:read, medication:read, twin:read, dashboard:view]
  patient:  [dashboard:view]  ← 仅能查看自己的数据（由 patient_id 过滤实现）
  family:   [dashboard:view]  ← 仅能查看关联患者的数据
```

**RBAC Middleware**：

```typescript
// core/trpc/middleware/rbac.ts

export function requirePermission(...codes: string[]) {
  return t.middleware(async ({ ctx, next }) => {
    const userRole = ctx.userRole; // from auth middleware
    const allowed = await checkPermission(ctx.db, userRole, codes);
    if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });
    return next();
  });
}

// 使用方式
patientRouter.create = protectedProcedure
  .use(requirePermission('patient:write'))
  .input(patientCreateSchema)
  .mutation(...)
```

### 3.4 新增 tRPC 路由

#### medicationRouter

```typescript
export const medicationRouter = router({
  list:       protectedProcedure.input(medicationListInput).query(...),      // 患者用药列表
  byId:       protectedProcedure.input(z.object({ id: z.string() })).query(...),
  create:     protectedProcedure.input(medicationCreateSchema).mutation(...),
  update:     protectedProcedure.input(medicationUpdateSchema).mutation(...),
  delete:     protectedProcedure.input(z.object({ id: z.string() })).mutation(...),
  schedules:  protectedProcedure.input(z.object({ medicationId: z.string() })).query(...),
  adherence:  protectedProcedure.input(adherenceListInput).query(...),       // 依从记录
  markTaken:  protectedProcedure.input(markTakenSchema).mutation(...),       // 标记已服
  markMissed: protectedProcedure.input(markMissedSchema).mutation(...),
})
```

#### appointmentRouter

```typescript
export const appointmentRouter = router({
  list:       protectedProcedure.input(appointmentListInput).query(...),
  byId:       protectedProcedure.input(z.object({ id: z.string() })).query(...),
  create:     protectedProcedure.input(appointmentCreateSchema).mutation(...),
  update:     protectedProcedure.input(appointmentUpdateSchema).mutation(...),
  cancel:     protectedProcedure.input(z.object({ id: z.string(), reason: z.string().optional() })).mutation(...),
  followups:  protectedProcedure.input(followupListInput).query(...),
  createFollowup: protectedProcedure.input(followupCreateSchema).mutation(...),
})
```

#### twinRouter

```typescript
export const twinRouter = router({
  // 地图
  map: router({
    get:       protectedProcedure.input(mapGetSchema).query(...),
    create:    protectedProcedure.input(mapCreateSchema).mutation(...),
    update:    protectedProcedure.input(mapUpdateSchema).mutation(...),
  }),
  // 房间
  rooms: router({
    list:      protectedProcedure.input(z.object({ mapId: z.string() })).query(...),
    create:    protectedProcedure.input(roomCreateSchema).mutation(...),
    update:    protectedProcedure.input(roomUpdateSchema).mutation(...),
    delete:    protectedProcedure.input(z.object({ id: z.string() })).mutation(...),
  }),
  // 实体
  entities: router({
    list:      protectedProcedure.input(entityListInput).query(...),
    create:    protectedProcedure.input(entityCreateSchema).mutation(...),
    update:    protectedProcedure.input(entityUpdateSchema).mutation(...),
    delete:    protectedProcedure.input(z.object({ id: z.string() })).mutation(...),
  }),
  // 虚拟人控制
  actor: router({
    getState:      protectedProcedure.input(z.object({ entityId: z.string() })).query(...),
    instruction:   protectedProcedure.input(instructionSchema).mutation(...),
    queueStatus:   protectedProcedure.input(z.object({ entityId: z.string() })).query(...),
  }),
  // 行为规则
  behaviors: router({
    list:      protectedProcedure.input(behaviorListInput).query(...),
    create:    protectedProcedure.input(behaviorCreateSchema).mutation(...),
    update:    protectedProcedure.input(behaviorUpdateSchema).mutation(...),
    delete:    protectedProcedure.input(z.object({ id: z.string() })).mutation(...),
    toggle:    protectedProcedure.input(z.object({ id: z.string(), enabled: z.boolean() })).mutation(...),
  }),
  // 活动日志
  activity: router({
    list:      protectedProcedure.input(activityListInput).query(...),
  }),
  // CV 检测
  cv: router({
    detections:  protectedProcedure.input(cvDetectionListInput).query(...),
    latest:      protectedProcedure.input(z.object({ patientId: z.string() })).query(...),
  }),
})
```

---

## 4. Phase 3: 前端品牌统一

### 4.1 抹茶绿配色方案

抹茶/绿茶色系的品牌主色调，以自然、健康、宁静为调性。

```
主色阶（Matcha Green）：
  50:  #F2F7ED  —  极淡绿底
  100: #E3EFD6  —  浅抹茶背景
  200: #C7E0AD  —  淡绿悬停态
  300: #AAD184  —  中浅绿边框
  400: #8EC15B  —  亮绿交互态
  500: #6BA539  —  主色（Matcha Green）— 按钮/链接/强调
  600: #56842E  —  深绿 Press 态
  700: #416323  —  深绿标题
  800: #2C4217  —  最深绿
  900: #17210C  —  极深绿

辅助色：
  Cream:     #FAFAF5  —  页面背景
  Paper:     #FFFFFF  —  卡片背景
  Warm Gray: #8C8C7E  —  次要文字
  Deep Gray: #3C3C3C  —  主要文字
  Error:     #D32F2F  —  告警/错误（保留红色以保障医疗场景可见性）
  Warning:   #ED6C02  —  警告
  Info:      #2E7D9F  —  信息
  Success:   #4A8C3F  —  成功（偏绿系）
```

### 4.2 React Web (Mantine v8)

```typescript
// apps/web/src/theme.ts

import { createTheme, MantineColorsTuple } from '@mantine/core';

const matchaGreen: MantineColorsTuple = [
  '#F2F7ED', '#E3EFD6', '#C7E0AD', '#AAD184',
  '#8EC15B', '#6BA539', '#56842E', '#416323', '#2C4217', '#17210C',
];

export const theme = createTheme({
  primaryColor: 'matchaGreen',
  colors: { matchaGreen },
  defaultRadius: 'md',
  fontFamily: '"Noto Sans SC", -apple-system, sans-serif',
  headings: {
    fontFamily: '"Noto Sans SC", sans-serif',
    fontWeight: '600',
  },
  other: {
    creamBg: '#FAFAF5',
    cardBg: '#FFFFFF',
    textPrimary: '#3C3C3C',
    textSecondary: '#8C8C7E',
  },
});
```

**改造清单**：
- `MantineProvider` 加载新主题，移除 `primaryColor: 'blue'`
- AppShell header 背景色改为 `matchaGreen[7]`（深绿），文字白色
- Navbar 激活态改为 matchaGreen 色系
- 所有按钮、Badge、Switch、Progress 跟随主色自动适配
- Login 页面背景使用奶油色渐变
- Dashboard 卡片添加浅绿阴影
- 告警相关组件保留红色系（critical = `#D32F2F`），警告保留橙色

### 4.3 Taro 小程序

```scss
// apps/miniapp/src/theme.scss

:root {
  // 品牌
  --brand-primary: #6BA539;
  --brand-primary-light: #AAD184;
  --brand-primary-dark: #416323;

  // 背景
  --bg-page: #FAFAF5;
  --bg-card: #FFFFFF;
  --bg-brand: #6BA539;

  // 文字
  --text-primary: #3C3C3C;
  --text-secondary: #8C8C7E;
  --text-brand: #6BA539;
  --text-on-brand: #FFFFFF;

  // 边框/分割
  --border-color: #C7E0AD;
  --border-radius: 8px;

  // 语义色（医疗场景保持红/橙）
  --color-error: #D32F2F;
  --color-warning: #ED6C02;
  --color-success: #4A8C3F;
  --color-info: #2E7D9F;
}
```

**改造清单**：
- 所有页面背景统一为 `--bg-page`
- 导航栏/顶部栏背景色统一为 `--brand-primary`
- 按钮/标签/选中态统一绿色系
- 九宫格图标区域颜色匹配
- 告警列表项保留红色 severity 标识
- Taro 原生组件（如 navigation bar）通过 `app.config.ts` 的 `window.navigationBarBackgroundColor` 设置

### 4.4 Flutter（维持现状，微调）

```dart
// apps/flutter/lib/theme.dart

import 'package:flutter/material.dart';

const MaterialColor matchaGreen = MaterialColor(0xFF6BA539, <int, Color>{
  50:  Color(0xFFF2F7ED),
  100: Color(0xFFE3EFD6),
  200: Color(0xFFC7E0AD),
  300: Color(0xFFAAD184),
  400: Color(0xFF8EC15B),
  500: Color(0xFF6BA539),
  600: Color(0xFF56842E),
  700: Color(0xFF416323),
  800: Color(0xFF2C4217),
  900: Color(0xFF17210C),
});

final theme = ThemeData(
  primarySwatch: matchaGreen,
  scaffoldBackgroundColor: const Color(0xFFFAFAF5),
  appBarTheme: const AppBarTheme(
    backgroundColor: Color(0xFF416323),
    foregroundColor: Colors.white,
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: const Color(0xFF6BA539),
      foregroundColor: Colors.white,
    ),
  ),
);
```

### 4.5 组件库使用策略

| 端 | 组件库 | 主题方式 |
|----|--------|---------|
| React Web | Mantine v8.3 | `createTheme` + `MantineProvider` |
| Taro 小程序 | Taro UI / 自建 | CSS Variables + Taro 配置 |
| Flutter | Material 3 | `ThemeData` + `ColorScheme.fromSeed` |

---

## 5. Phase 4: 数字孪生引擎

### 5.1 核心设计理念

> 逻辑与表现分离：引擎运行在服务端，负责寻路、行为、状态管理。视图（3D/2D）作为消费者，通过 WebSocket 订阅引擎状态后渲染。参考 RimWorld 的 Pawn/Job/Path 三层架构，但适配居家健康场景。

### 5.2 引擎架构

```
┌─────────────────────────────────────────────────────┐
│                   TwinEngine (twin/engine.ts)        │
│                                                      │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │Instruction │  │  Behavior   │  │  Pathfinding │ │
│  │  Manager   │─▶│   Engine    │─▶│   (A*)       │ │
│  │            │  │             │  │              │ │
│  │ - queue    │  │ - state     │  │ - nav graph  │ │
│  │ - priority │  │   machine   │  │ - door aware │ │
│  │ - preempt  │  │ - postures  │  │ - collision  │ │
│  └────┬───────┘  └──────┬──────┘  └──────┬───────┘ │
│       │                 │                 │          │
│       │    ┌────────────┴─────────────────┘          │
│       │    │                                         │
│       ▼    ▼                                         │
│  ┌─────────────────┐   ┌─────────────────┐          │
│  │  Scheduler      │   │  State          │          │
│  │  (作息调度)      │   │  Broadcaster    │          │
│  │                 │   │  (WebSocket)     │──── Web  │
│  │ - cron rules    │   │                 │          │
│  │ - behavior      │   │ - tick events   │          │
│  │   rules         │   │ - actor states  │          │
│  └─────────────────┘   └─────────────────┘          │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              Map Manager                      │   │
│  │  - grid loading/saving                       │   │
│  │  - room registration                         │   │
│  │  - entity placement validation               │   │
│  │  - nav graph generation                      │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 5.3 指令接口（Instruction Manager）

虚拟人的所有行为通过指令队列控制，外部模块只需下发指令。

```typescript
// twin/instruction.ts

type InstructionType = 'move_to' | 'move_to_room' | 'use_object' | 'stay' | 'change_posture' | 'idle';

interface Instruction {
  id: string;
  type: InstructionType;
  actorEntityId: string;
  params: InstructionParams;
  priority: number;            // 0=最高, 数字越大越低
  preemptible: boolean;       // 是否可被更高优先级指令打断
  onComplete?: string;        // 完成后触发的下一指令 ID
}

type InstructionParams =
  | { type: 'move_to'; x: number; y: number }
  | { type: 'move_to_room'; roomId: string }
  | { type: 'use_object'; entityId: string; duration?: number }
  | { type: 'stay'; duration: number }           // 停留指定秒数
  | { type: 'change_posture'; posture: ActorPosture }
  | { type: 'idle' };

// 下发指令（外部接口）
function enqueueInstruction(engine: TwinEngine, instruction: Instruction): void;

// 当前指令
function getActiveInstruction(actorId: string): Instruction | null;

// 队列状态
function getInstructionQueue(actorId: string): Instruction[];
```

### 5.4 行为状态机（Behavior Engine）

```
              ┌──────────┐
     ┌───────▶│   IDLE   │◀────────┐
     │        └────┬─────┘         │
     │             │               │
     │   instruction                │ instruction
     │   received                   │ completed
     │             │               │
     │             ▼               │
     │        ┌──────────┐         │
     │        │  MOVING  │─────────┘
     │        └────┬─────┘
     │             │ path blocked / door
     │             ▼
     │        ┌──────────┐
     │        │ WAITING  │ (等待门/障碍清除)
     │        └────┬─────┘
     │             │ path clear
     │             ▼
     │        ┌──────────┐
     └────────│  ACTING  │ (使用物件/执行动作)
              └──────────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
  ┌────────┐  ┌────────┐  ┌────────┐
  │SLEEPING│  │ EATING │  │TOILET  │  ← 特殊状态（与 ACTING 互斥）
  └────────┘  └────────┘  └────────┘
```

```typescript
// twin/behavior.ts

type BehaviorState = 'idle' | 'moving' | 'acting' | 'sleeping' | 'eating' | 'toilet' | 'shower' | 'waiting';

interface BehaviorContext {
  actorId: string;
  currentState: BehaviorState;
  currentRoomId: string | null;
  currentPosture: ActorPosture;
  activeInstruction: Instruction | null;
}

function transitionState(ctx: BehaviorContext, instruction: Instruction): BehaviorContext;

function updateState(engine: TwinEngine, actorId: string, dt: number): void;
```

### 5.5 寻路系统（A* + 门感知）

关键创新：**门不是墙**。寻路时门是可通行的，但需要考虑门的状态（开/关）。

```typescript
// twin/pathfinding.ts

interface PathNode {
  x: number;
  y: number;
  g: number;    // 起点到当前的成本
  h: number;    // 当前到终点的启发式成本
  f: number;    // g + h
  parent: PathNode | null;
}

// 寻路主函数
function findPath(
  grid: Tile[][],
  navGraph: NavGraphData,
  from: { x: number; y: number },
  to: { x: number; y: number },
  actorId: string,
): { x: number; y: number }[] | null;

// 瓦片通行性检查（考虑门）
function isPassable(grid: Tile[][], x: number, y: number, actorId: string): boolean {
  const tile = grid[x][y];
  if (tile.terrain === 'void') return false;
  if (tile.terrain === 'wall') return false;
  if (tile.terrain === 'door') {
    // 门是可通行的（自动开门/关门逻辑）
    return true;
  }
  return true;
}

// 导航图预计算（地图加载时）
function generateNavGraph(map: TwinMap): NavGraphData {
  // 1. 为每个房间创建房间节点
  // 2. 找出相邻房间的门作为边
  // 3. 生成分层寻路图：房间间 + 房间内
}
```

**寻路策略**：
1. **分层寻路**：先确定房间级路径（卧室→走廊→厨房），再计算房间内精确路径
2. **门感知**：寻路路径包含门节点，到达时触发开门动画/延迟
3. **家具避让**：大型家具标记不可通行瓦片
4. **多人避让**：简单等待机制——两虚拟人路径交叉时低优先级等待

### 5.6 导航网格（NavMesh）

地图编辑完成后预计算导航图，存储到 `twin_nav_graph`：

```typescript
interface NavGraphData {
  rooms: NavRoomNode[];       // 房间节点
  edges: NavEdge[];            // 门连通边
  passabilityGrid: number[][]; // 0=不可通行, 1=空地, 2=门
}

interface NavRoomNode {
  roomId: string;
  centroid: { x: number; y: number };   // 房间几何中心
  walkableTiles: { x: number; y: number }[];
}

interface NavEdge {
  fromRoomId: string;
  toRoomId: string;
  doorX: number;
  doorY: number;
}
```

### 5.7 作息调度器（Scheduler）

根据 `twin_behavior_rules` 中的 schedule 规则定时生成指令：

```typescript
// twin/scheduler.ts

interface ScheduleEntry {
  time: string;              // '07:00', '12:00', '22:00'
  action: InstructionType;
  target: string;            // roomId / entityId
  duration?: number;
}

function runScheduler(engine: TwinEngine): void {
  const now = engine.simulatedTime;  // 仿真时间
  const hourMinute = formatTime(now);

  for (const actor of engine.actors) {
    const rules = engine.getBehaviorRules(actor.patientId);
    for (const rule of rules) {
      if (rule.triggerTime === hourMinute && rule.isEnabled) {
        const instruction = ruleToInstruction(rule, actor.id);
        enqueueInstruction(engine, instruction);
      }
    }
  }
}
```

### 5.8 CV 桥接层（CV Bridge）

```typescript
// ingest/cv-bridge/index.ts

interface CvDetection {
  cameraId: string;
  patientId: string;
  detectedClass: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  timestamp: number;
}

async function handleCvDetection(db: DrizzleClient, engine: TwinEngine, detection: CvDetection): Promise<void> {
  // 1. 推断房间（根据相机 ID 映射）
  const roomId = resolveCameraRoom(detection.cameraId);

  // 2. 写入 twin_cv_detections 表
  await db.insert(twinCvDetections).values({
    patientId: detection.patientId,
    cameraId: detection.cameraId,
    detectedAt: new Date(detection.timestamp),
    detectedClass: detection.detectedClass,
    confidence: detection.confidence,
    bbox: detection.bbox,
    inferredRoomId: roomId,
    synced: false,
  });

  // 3. 写入 events 表（location 事件）
  await db.insert(events).values({
    patientId: detection.patientId,
    kind: 'location',
    metric: 'cv_detection',
    confidence: detection.confidence,
    source: 'cv',
    tags: { cameraId: detection.cameraId, roomId, bbox: detection.bbox },
  });

  // 4. 通知孪生引擎移动 Actor
  if (roomId && detection.confidence > 0.7) {
    const actorEntityId = engine.getActorByPatientId(detection.patientId);
    if (actorEntityId) {
      enqueueInstruction(engine, {
        id: generateId(),
        type: 'move_to_room',
        actorEntityId,
        params: { type: 'move_to_room', roomId },
        priority: 0, // CV 数据优先级最高，覆盖引擎推测
        preemptible: false,
      });

      // 标记已同步
      await db.update(twinCvDetections)
        .set({ synced: true, syncedAt: new Date() })
        .where(eq(twinCvDetections.id, saved.id)); // saved from step 2
    }
  }
}
```

### 5.9 表现层（Render Agnostic）

前端通过 WebSocket 消息获取引擎状态：

```typescript
// WebSocket 消息格式（/ws?mapId=xxx）

interface WsMessage {
  type: 'tick' | 'actor_moved' | 'actor_state_changed' | 'room_entered' | 'room_exited';
  payload: {
    tick?: number;
    simTime?: number;
    actors?: ActorStateSnapshot[];
    events?: StateChangeEvent[];
  };
}

interface ActorStateSnapshot {
  entityId: string;
  tileX: number;
  tileY: number;
  posture: string;
  behaviorState: string;
  currentRoomId: string | null;
  pathProgress: number;
}

// React 端消费
// hooks/useTwinRealtime.ts
function useTwinRealtime(mapId: string) {
  const ws = useRef<WebSocket>();
  const store = useTwinStore();

  useEffect(() => {
    ws.current = new WebSocket(`ws://host/ws?mapId=${mapId}`);
    ws.current.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data);
      if (msg.type === 'actor_moved') {
        store.updateActors(msg.payload.actors!);
      }
    };
    return () => ws.current?.close();
  }, [mapId]);
}
```

### 5.10 引擎入口 API

```typescript
// twin/engine.ts

interface TwinEngine {
  map: TwinMap;
  actors: Map<string, Actor>;
  scheduler: Scheduler;
  behaviorEngine: BehaviorEngine;
  pathfinder: Pathfinder;
  running: boolean;
  speed: number;
  tickInterval: NodeJS.Timer | null;
}

function createEngine(map: TwinMap, db: DrizzleClient): TwinEngine;
function startEngine(engine: TwinEngine): void;
function stopEngine(engine: TwinEngine): void;
function setSpeed(engine: TwinEngine, speed: number): void;
function tick(engine: TwinEngine): void;  // 单步推进（用于调试）
```

---

## 6. Phase 5: 跨系统耦合

### 6.1 实体关系全景

```
                     ┌─────────────┐
                     │    users    │
                     └──┬──────┬──┘
            ┌───────────┘      └───────────┐
            ▼                              ▼
   ┌──────────────┐              ┌─────────────────┐
   │  wechat/oauth│              │  family_links   │
   └──────────────┘              └────────┬────────┘
                                          │
            ┌─────────────────────────────┘
            ▼
     ┌────────────┐         ┌─────────────────┐
     │  patients  │────────▶│patient_conditions│
     └──┬──┬──┬───┘         │patient_allergies │
        │  │  │             │patient_snapshots │
        │  │  │             │patient_rooms     │
        │  │  │             └─────────────────┘
        │  │  │
   ┌────┘  │  └────┐
   ▼       ▼       ▼
┌──────┐ ┌──────┐ ┌──────────┐
│devices│ │events│ │twin_maps │
└──┬───┘ └──┬───┘ └────┬─────┘
   │        │            │
   │   ┌────┘       ┌────┴────────┐
   │   ▼            ▼             ▼
   │ cv_detections twin_rooms  twin_entities
   │                            │
   │                   ┌────────┼────────┐
   │                   ▼        ▼        ▼
   │            twin_actor   twin_behavior twin_activity
   │              _states      _rules       _log
   │                   │
   │            ┌──────┘
   │            ▼
   │     twin_nav_graph
   │
   └──────────────────────────────┐
                                  ▼
                         ┌──────────────┐
                         │ medications  │
                         └──────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              medication_   medication_   twin_actor_
              schedules     adherence     states
              (触发用药     (依从记录     (产生 "去厨房
               提醒)         写入事件)      服药" 指令)
```

### 6.2 关键集成流

#### 6.2.1 CV 检测 → 孪生位置同步

```
摄像头 RTSP → 本地 YOLO 推理 → POST /api/cv/detect → Server
  → ingest/cv-bridge 处理
    → 写入 cv_detections + events(location)
    → 推断房间 → 下发 actor.move_to_room() 指令
    → WebSocket 推送给前端 3D 视图
```

#### 6.2.2 IoT 设备 → 孪生行为驱动

```
智能床垫 → MQTT "bed_exit" → ingest/mqtt 处理
  → 写入 events(observation, metric=bed_exit)
  → 查找关联 actor → 下发 actor.change_posture('standing')
  → 检查行为规则 → 如有 "起床→去卫生间" 规则 → 下发 move_to_room('bathroom')
```

#### 6.2.3 用药提醒 → 孪生事件

```
Scheduler 检测服药时间 → 创建 medication_adherence 记录(status=missed)
  → 写入 events(alert, metric=medication_reminder)
  → 通知小程序推送
  → 可选：向 twin engine 下发 actor.move_to_room('kitchen') (家庭场景)
```

#### 6.2.4 孪生活动 → 健康记录

```
engine.tick() → actor 完成行为 → 写入 twin_activity_log
  → 定期聚合 (每天凌晨) → 生成 patient_snapshots
  → 长周期趋势分析 → 异常检测 → 自动生成 alert
```

#### 6.2.5 告警全链路

```
传感器异常 / CV 跌倒 / 用药逾期 / 孪生异常行为
  → 写入 events(kind=alert)
  → WebSocket 推送给前端（弹窗 + 声音）
  → 小程序推送（家属端）
  → 记录 audit_logs
```

### 6.3 Event Bus 扩展

events 表新增 `kind` 值：

| kind | 含义 | 示例 metric |
|------|------|------------|
| `observation` | 生理观测值 | heart_rate, spO2, temperature |
| `alert` | 告警 | fall_detected, tachycardia, missed_medication |
| `behavior` | 孪生行为事件 | started_sleeping, entered_bathroom, meal_skipped |
| `location` | 位置事件 | cv_detection, room_entered, room_exited |

events 表新增 `source` 字段，所有数据写手标注来源：
- `iot` — 传感器设备原始数据
- `cv` — 计算机视觉检测
- `simulator` — 生理仿真生成
- `manual` — 人工录入（随访测量、手动修正）

### 6.4 性能考量

| 场景 | 策略 |
|------|------|
| events 表写多读少 | BRIN 索引 + 分区表（按 patient_id hash） |
| WebSocket 高频推送 | 仅发送变化的数据，diff 比较 |
| 孪生引擎多患者并发 | 每患者独立 tick，异步并行 |
| CV 检测高频（30fps） | 降采样至 2fps，去重（位置变化 <0.1m 忽略） |
| 3D 渲染性能 | LOD 层级，远距离用 Billboard，近距离用 3D Mesh |

---

## 7. DB Schema 总览

### 7.1 完整表清单（29 表）

| # | 表名 | 所属模块 | 说明 |
|---|------|---------|------|
| 1 | users | 用户认证 | 核心用户 |
| 2 | wechat_accounts | 用户认证 | 微信登录 |
| 3 | oauth_accounts | 用户认证 | OAuth 预留 |
| 4 | family_links | 用户认证 | 家属关联 |
| 5 | permissions | 用户认证 | 权限码 |
| 6 | role_permissions | 用户认证 | 角色权限 |
| 7 | patients | 患者档案 | 核心患者 |
| 8 | patient_conditions | 患者档案 | 既往病史 |
| 9 | patient_allergies | 患者档案 | 过敏信息 |
| 10 | patient_snapshots | 患者档案 | 健康快照 |
| 11 | patient_rooms | 患者档案 | 房间分区 |
| 12 | devices | 设备管理 | IoT 设备 |
| 13 | events | 事件总线 | 核心数据总线 |
| 14 | cv_detections | 事件总线 | CV 检测结果 |
| 15 | medications | 用药管理 | 药物处方 |
| 16 | medication_schedules | 用药管理 | 服药时刻 |
| 17 | medication_adherence | 用药管理 | 服药依从 |
| 18 | appointments | 预约随访 | 预约记录 |
| 19 | followup_records | 预约随访 | 随访记录 |
| 20 | twin_maps | 数字孪生 | 地图定义 |
| 21 | twin_rooms | 数字孪生 | 房间分区 |
| 22 | twin_entities | 数字孪生 | 孪生实体 |
| 23 | twin_actor_states | 数字孪生 | 虚拟人状态 |
| 24 | twin_behavior_rules | 数字孪生 | 行为规则 |
| 25 | twin_activity_log | 数字孪生 | 活动日志 |
| 26 | twin_nav_graph | 数字孪生 | 导航网格 |
| 27 | twin_cv_detections | 数字孪生 | CV 孪生关联 |
| 28 | audit_logs | 系统 | 审计日志（保留） |
| 29 | ingest_raw_data | 系统 | 原始数据（保留） |

需废弃：`map_configs`（由 `twin_maps` 替代）

### 7.2 迁移策略

1. **增量迁移**：保留现有 8 表不动，新增 21 表
2. **数据迁移**：`map_configs` → `twin_maps`（提取 grid、宽高，反序列化 zone → twin_rooms）
3. **代码兼容期**：保留原 `map_configs` 路由 1-2 个 Phase，增加 deprecation header
4. **回滚**：每个 Phase 的迁移文件独立，可单独回滚

---

## 附录: 与现状的对照分析

### 必要性对照

| 需求项 | 当前状态 | 必要性 | 理由 |
|--------|---------|--------|------|
| 微信登录 | 无，仅用户名密码 | **高** | 小程序核心入口，患者/家属端必需 |
| RBAC 精细化 | 简单 role 字段，无权限表 | **中** | 6 种角色 + 未来扩展，硬编码 role 检查不可持续 |
| 健康档案(EHR) | 仅患者基础字段 + events 记录 | **高** | 医疗健康应用核心，缺乏结构化病史/过敏/用药管理 |
| 用药管理 | 无 | **高** | 居家健康监护刚需，直接关联孪生行为 |
| 预约随访 | 无 | **中** | 打通线上→线下闭环 |
| 孪生独立引擎 | 混在 shared-types map 中，无运行时 | **高** | 用户明确指定为第一公民 |
| 三端主题统一 | 蓝色 Mantine，Taro/Flutter 无统一主题 | **中** | 品牌建设，用户体验一致性 |
| CV 集成 | 仅在 Flutter YOLO 中，未接入后端 | **中** | 虚实同步的核心数据源 |

### 合理性对照

| 设计决策 | 备选方案 | 选择理由 |
|---------|---------|---------|
| 窄表 + jsonb 混合 | 纯结构化 EAV 表 | jsonb 灵活扩展设备新指标，结构化字段保证查询/索引性能 |
| Code-based RBAC | Casbin/ABAC | 角色-权限关系简单，Code 匹配零学习成本，后续可升级 |
| A* 分层寻路 | 纯 A* + JPS | 居家地图小（<20x20），分层减少跨房间寻路开销，门节点自然分层 |
| WebSocket 推送孪生状态 | 轮询 / Server-Sent Events | 双向通信需求（指令下发），已有 ws 基础 |
| Drizzle ORM 单 schema 文件 | 多 schema 文件按模块拆分 | 按现有规范 ≤200 行文件限制，schema 行数超限制时再拆分 |
| 孪生引擎独立 Context | 融入 core | 隔离性 → 引擎可独立测试、独立部署、逻辑不污染业务层 |
| 三端共用品牌色号 | 各端独立调色 | CSS变量/Mantine主题/Flutter Theme 均可还原同一色号 |

---

> **规格版本**: v1.0
> **状态**: 设计完成，待用户审阅
> **下一步**: 用户审阅确认 → 编写实施计划 (writing-plans skill)
