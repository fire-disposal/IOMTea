import {
  date,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  medicationStatusEnum,
  medicationRouteEnum,
  adherenceStatusEnum,
  confirmationMethodEnum,
} from './enums'
import { users, patients } from '../schema'

export const medications = pgTable('medications', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id')
    .references(() => patients.id, { onDelete: 'cascade' })
    .notNull(),
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
  medicationId: uuid('medication_id')
    .references(() => medications.id, { onDelete: 'cascade' })
    .notNull(),
  scheduledTime: time('scheduled_time').notNull(),
  dayOfWeek: integer('day_of_week').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const medicationAdherence = pgTable(
  'medication_adherence',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scheduleId: uuid('schedule_id')
      .references(() => medicationSchedules.id, { onDelete: 'cascade' })
      .notNull(),
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
