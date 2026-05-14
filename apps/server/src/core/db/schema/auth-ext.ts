import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { roleEnum } from './enums'
import { users } from '../schema'

export const wechatAccounts = pgTable('wechat_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique().notNull(),
  openId: text('open_id').unique().notNull(),
  unionId: text('union_id'),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
})

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    role: roleEnum('role').notNull(),
    permissionCode: text('permission_code').references(() => permissions.code, { onDelete: 'cascade' }).notNull(),
  },
  (t) => ({
    unq: uniqueIndex('role_permissions_unique').on(t.role, t.permissionCode),
  }),
)
