import { boolean, jsonb, pgTable, timestamp, uuid, varchar, primaryKey } from 'drizzle-orm/pg-core'
import { patients } from '../schema.js'

export const simConfigs = pgTable('sim_configs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  profileName: varchar('profile_name', { length: 50 }).notNull(),
  running: boolean('running').default(true).notNull(),
  metrics: jsonb('metrics').notNull().$type<{ name: string; enabled: boolean; config: any }[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const simPatients = pgTable(
  'sim_patients',
  {
    simId: varchar('sim_id', { length: 64 })
      .references(() => simConfigs.id, { onDelete: 'cascade' })
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.simId, t.patientId] }) }),
)
