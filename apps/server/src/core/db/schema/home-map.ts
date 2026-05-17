import { integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { patients } from '../schema'

export const homeMaps = pgTable('home_maps', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').notNull().unique().references(() => patients.id, { onDelete: 'cascade' }),
  templateId: varchar('template_id', { length: 64 }),
  packedGrid: varchar('packed_grid', { length: 65535 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const homeThings = pgTable('home_things', {
  id: uuid('id').defaultRandom().primaryKey(),
  mapId: uuid('map_id').notNull().references(() => homeMaps.id, { onDelete: 'cascade' }),
  thingType: varchar('thing_type', { length: 64 }).notNull(),
  tileX: integer('tile_x').notNull(),
  tileY: integer('tile_y').notNull(),
  tileW: integer('tile_w').default(1),
  tileH: integer('tile_h').default(1),
  rotation: integer('rotation').default(0),
  deviceId: uuid('device_id').unique(),
  tags: jsonb('tags').default('{}'),
  config: jsonb('config').default('{}'),
})
