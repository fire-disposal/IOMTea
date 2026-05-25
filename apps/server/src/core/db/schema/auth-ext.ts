import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../schema.js'

export const wechatAccounts = pgTable('wechat_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  openId: text('open_id').unique().notNull(),
  unionId: text('union_id'),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

