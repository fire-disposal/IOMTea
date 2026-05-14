import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { appointmentTypeEnum, appointmentStatusEnum, followupTypeEnum } from './enums'
import { users, patients } from '../schema'

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
