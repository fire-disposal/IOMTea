import {
  date,
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'doctor', 'nurse', 'caregiver'])
export const deviceTypeEnum = pgEnum('device_type', [
  'mattress',
  'vision',
  'imu',
  'generic',
  'simulator',
  'custom',
])
export const deviceStatusEnum = pgEnum('device_status', ['active', 'inactive', 'maintenance'])
export const patientStatusEnum = pgEnum('patient_status', ['active', 'discharged'])
export const alertSeverityEnum = pgEnum('alert_severity', ['critical', 'warning', 'info'])
export const alertStatusEnum = pgEnum('alert_status', ['active', 'acknowledged', 'resolved'])
export const kindEnum = pgEnum('kind', ['observation', 'alert'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  role: roleEnum('role').notNull().default('caregiver'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('refresh_tokens_user_id_idx').on(t.userId),
    expiresIdx: index('refresh_tokens_expires_idx').on(t.expiresAt),
  }),
)

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  birthDate: date('birth_date'),
  gender: varchar('gender', { length: 10 }),
  room: varchar('room', { length: 20 }),
  bedNumber: varchar('bed_number', { length: 20 }),
  status: patientStatusEnum('status').notNull().default('active'),
  tags: jsonb('tags').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const devices = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  serialNumber: varchar('serial_number', { length: 100 }).notNull().unique(),
  deviceType: deviceTypeEnum('device_type').notNull(),
  status: deviceStatusEnum('status').notNull().default('active'),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  tags: jsonb('tags').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    kind: kindEnum('kind').notNull(),
    metric: varchar('metric', { length: 50 }).notNull(),
    value: doublePrecision('value'),
    unit: varchar('unit', { length: 20 }),
    severity: alertSeverityEnum('severity'),
    status: alertStatusEnum('status'),
    tags: jsonb('tags').default({}).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    patientMetricIdx: index('events_patient_metric_time_idx').on(
      t.patientId,
      t.metric,
      t.recordedAt.desc(),
    ),
    patientKindIdx: index('events_patient_kind_time_idx').on(
      t.patientId,
      t.kind,
      t.recordedAt.desc(),
    ),
    deviceTimeIdx: index('events_device_time_idx').on(t.deviceId, t.recordedAt.desc()),
  }),
)

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

export const mapConfigs = pgTable('map_configs', {
  id: varchar('id', { length: 50 }).primaryKey(),
  data: jsonb('data').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
