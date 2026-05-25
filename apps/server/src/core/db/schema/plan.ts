import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users, patients } from '../schema'

export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  fields: jsonb('fields').notNull().default(sql`'[]'::jsonb`),
  rewardCredits: integer('reward_credits').notNull().default(0),
  cron: text('cron'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const planCompletions = pgTable('plan_completions', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  responses: jsonb('responses'),
  creditsEarned: integer('credits_earned').notNull().default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
})

export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  amount: integer('amount').notNull(),
  kind: text('kind').notNull(),
  source: text('source').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
