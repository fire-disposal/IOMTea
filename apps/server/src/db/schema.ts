import {
  pgTable,
  uuid,
  varchar,
  text,
  doublePrecision,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'doctor', 'nurse', 'caregiver'])
export const deviceTypeEnum = pgEnum('device_type', ['mattress', 'vision', 'imu', 'generic'])
export const deviceStatusEnum = pgEnum('device_status', ['active', 'inactive', 'maintenance'])
export const patientStatusEnum = pgEnum('patient_status', ['active', 'discharged'])
export const alertSeverityEnum = pgEnum('alert_severity', ['critical', 'warning', 'info'])
export const alertStatusEnum = pgEnum('alert_status', ['active', 'acknowledged', 'resolved'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  role: roleEnum('role').notNull().default('caregiver'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  birthDate: varchar('birth_date', { length: 10 }),
  gender: varchar('gender', { length: 10 }),
  room: varchar('room', { length: 20 }),
  bedNumber: varchar('bed_number', { length: 20 }),
  status: patientStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const devices = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  serialNumber: varchar('serial_number', { length: 100 }).notNull().unique(),
  deviceType: deviceTypeEnum('device_type').notNull(),
  status: deviceStatusEnum('status').notNull().default('active'),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const dataStreams = pgTable('data_streams', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  streamType: varchar('stream_type', { length: 20 }).notNull(),
  dataType: varchar('data_type', { length: 50 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const observations = pgTable('observations', {
  id: uuid('id').defaultRandom().primaryKey(),
  streamId: uuid('stream_id').notNull().references(() => dataStreams.id, { onDelete: 'cascade' }),
  valueNumeric: doublePrecision('value_numeric'),
  valueText: text('value_text'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const alertEvents = pgTable('alert_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  streamId: uuid('stream_id').references(() => dataStreams.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 50 }).notNull(),
  severity: alertSeverityEnum('severity').notNull(),
  status: alertStatusEnum('status').notNull().default('active'),
  payload: jsonb('payload').default({}),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

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
