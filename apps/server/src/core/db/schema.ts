import { sql } from 'drizzle-orm'
import {
  date,
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
  eventSourceEnum,
  genderEnum,
  kindEnum,
  patientStatusEnum,
  roleEnum,
  userStatusEnum,
} from './schema/enums'
import { usersPin } from './schema/pin'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).unique(),
  passwordHash: text('password_hash'),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  avatarUrl: text('avatar_url'),
  phone: varchar('phone', { length: 20 }).unique(),
  email: varchar('email', { length: 255 }).unique(),
  role: roleEnum('role').notNull().default('user'),
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
  gender: genderEnum('gender'),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  bloodType: bloodTypeEnum('blood_type'),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  emergencyContact: varchar('emergency_contact', { length: 100 }),
  emergencyPhone: varchar('emergency_phone', { length: 20 }),
  status: patientStatusEnum('status').notNull().default('active'),
  tags: jsonb('tags').default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    type: text('type'),
    status: text('status').default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    tags: jsonb('tags').default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    patientIdx: index('sessions_patient_id_idx').on(t.patientId),
    statusIdx: index('sessions_status_idx').on(t.status),
    startedIdx: index('sessions_started_at_idx').on(t.startedAt),
  }),
)

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    pinCode: varchar('pin_code', { length: 6 }).references(() => usersPin.pin, {
      onDelete: 'set null',
    }),
    kind: kindEnum('kind').notNull(),
    metric: varchar('metric', { length: 100 }).notNull(),
    value: jsonb('value').notNull(),
    unit: varchar('unit', { length: 50 }),
    confidence: real('confidence'),
    source: eventSourceEnum('source').default('manual'),
    severity: alertSeverityEnum('severity'),
    status: alertStatusEnum('status'),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    tags: jsonb('tags').default(sql`'{}'::jsonb`).notNull(),
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
    patientSourceIdx: index('events_patient_source_idx').on(t.patientId, t.source),
    sessionIdx: index('events_session_id_idx').on(t.sessionId),
  }),
)
