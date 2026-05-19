import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { checklistStatusEnum, transactionTypeEnum } from './enums'
import { events, users } from '../schema'

export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).default('我的健康计划').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const planItems = pgTable(
  'plan_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .references(() => plans.id, { onDelete: 'cascade' })
      .notNull(),
    moduleKey: varchar('module_key', { length: 50 }).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    reminderEnabled: boolean('reminder_enabled').default(false).notNull(),
    reminderTimes: jsonb('reminder_times').default('[]').notNull(),
    frequency: varchar('frequency', { length: 20 }).default('daily').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex('plan_items_unique').on(t.planId, t.moduleKey),
  }),
)

export const dailyChecklists = pgTable(
  'daily_checklists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    date: date('date').notNull(),
    moduleKey: varchar('module_key', { length: 50 }).notNull(),
    status: checklistStatusEnum('status').default('pending').notNull(),
    planItemId: uuid('plan_item_id').references(() => planItems.id, {
      onDelete: 'set null',
    }),
    recordId: uuid('record_id').references(() => events.id, {
      onDelete: 'set null',
    }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex('daily_checklist_unique').on(t.userId, t.date, t.moduleKey),
    userIdDateIdx: uniqueIndex('daily_checklist_user_date_idx').on(t.userId, t.date),
  }),
)

export const streaks = pgTable(
  'streaks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    moduleKey: varchar('module_key', { length: 50 }).notNull(),
    currentStreak: integer('current_streak').default(0).notNull(),
    longestStreak: integer('longest_streak').default(0).notNull(),
    lastRecordDate: date('last_record_date'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex('streaks_unique').on(t.userId, t.moduleKey),
  }),
)

export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  amount: integer('amount').notNull(),
  moduleKey: varchar('module_key', { length: 50 }),
  streakDay: integer('streak_day'),
  type: transactionTypeEnum('type').default('earn').notNull(),
  source: varchar('source', { length: 100 }).default('record').notNull(),
  checklistId: uuid('checklist_id').references(() => dailyChecklists.id, {
    onDelete: 'set null',
  }),
  eventId: uuid('event_id').references(() => events.id, {
    onDelete: 'set null',
  }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
