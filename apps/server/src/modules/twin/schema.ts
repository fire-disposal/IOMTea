import { pgTable, uuid, text, jsonb, timestamp, boolean, real, primaryKey } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { patients } from '../../core/db/schema.js'

export const simConfigs = pgTable('sim_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  profileName: text('profile_name').notNull(),
  metrics: jsonb('metrics').default(sql`'{}'::jsonb`).notNull(),
  running: boolean('running').default(false).notNull(),
  speed: real('speed').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const simPatients = pgTable(
  'sim_patients',
  {
    simId: uuid('sim_id')
      .notNull()
      .references(() => simConfigs.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.simId, t.patientId] }) }),
)
