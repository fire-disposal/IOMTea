import { sql } from 'drizzle-orm'
import { date, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { patients, users } from '../schema.js'
import { medicationRouteEnum, medicationStatusEnum } from './enums'

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
  tags: jsonb('tags').default(sql`'{}'::jsonb`),
  status: medicationStatusEnum('status').notNull().default('active'),
  prescribedById: uuid('prescribed_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
