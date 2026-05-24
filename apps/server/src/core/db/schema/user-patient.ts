import { pgTable, timestamp, uuid, varchar, primaryKey } from 'drizzle-orm/pg-core'
import { users } from '../schema.js'
import { patients } from '../schema.js'

export const userPatientLinks = pgTable(
  'user_patient_links',
  {
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
    relation: varchar('relation', { length: 20 }).default('caregiver').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.patientId] }) }),
)
