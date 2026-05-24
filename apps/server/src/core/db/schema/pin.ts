import { boolean, jsonb, pgTable, timestamp, uuid, varchar, text } from 'drizzle-orm/pg-core'
import { users } from '../schema.js'
import { pinTypeEnum } from './enums'

export const usersPin = pgTable('users_pin', {
  pin: varchar('pin', { length: 6 }).primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: pinTypeEnum('type').notNull().default('device'),
  label: varchar('label', { length: 64 }).default(''),
  nickname: varchar('nickname', { length: 32 }).default(''),
  description: text('description').default(''),
  roomId: varchar('room_id', { length: 64 }),
  isVirtual: boolean('is_virtual').default(false),
  generatorConfig: jsonb('generator_config').default('{}'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
