import { pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { patients } from '../schema.js'

export const patientTags = pgTable('patient_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).unique().notNull(),
  color: varchar('color', { length: 7 }).default('#228be6'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const patientTagLinks = pgTable(
  'patient_tag_links',
  {
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: uuid('tag_id')
      .references(() => patientTags.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.patientId, t.tagId] }),
  }),
)
