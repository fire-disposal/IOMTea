import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const formDefinitions = pgTable('form_definitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').unique().notNull(),
  title: text('title').notNull(),
  description: text('description'),
  cron: text('cron'),
  fields: jsonb('fields').notNull(),
  status: text('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const formResponses = pgTable('form_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  formCode: text('form_code').notNull(),
  patientId: uuid('patient_id').notNull(),
  userId: uuid('user_id'),
  responses: jsonb('responses').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
})
