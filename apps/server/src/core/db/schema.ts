import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import {
  alertSeverityEnum,
  alertStatusEnum,
  bloodTypeEnum,
  deviceStatusEnum,
  deviceTypeEnum,
  eventSourceEnum,
  genderEnum,
  kindEnum,
  patientStatusEnum,
  roleEnum,
  userStatusEnum,
} from './schema/enums'

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
  credit: integer('credit').default(0).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

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

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 100 }).notNull(),
  birthDate: date('birth_date'),
  gender: genderEnum('gender'),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  bloodType: bloodTypeEnum('blood_type'),
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

export const devices = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  serialNumber: varchar('serial_number', { length: 100 }).notNull().unique(),
  deviceType: deviceTypeEnum('device_type').notNull(),
  model: varchar('model', { length: 100 }),
  manufacturer: varchar('manufacturer', { length: 100 }),
  firmwareVersion: varchar('firmware_version', { length: 50 }),
  status: deviceStatusEnum('status').notNull().default('inactive'),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  roomId: varchar('room_id', { length: 64 }),
  config: jsonb('config').default({}).notNull(),
  lastSeenAt: timestamp('last_seen', { withTimezone: true }),
  tags: jsonb('tags').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    pinCode: varchar('pin_code', { length: 6 }),
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


