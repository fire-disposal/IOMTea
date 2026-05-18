import { sql } from 'drizzle-orm'
import { boolean, integer, jsonb, pgTable, real, text, time, timestamp, uuid } from 'drizzle-orm/pg-core'
import {
  actorPostureEnum,
  behaviorRuleTypeEnum,
  behaviorStateEnum,
  entityCategoryEnum,
  orientationEnum,
  roomTypeEnum,
} from './enums'
import { devices, patients } from '../schema'

export const twinMaps = pgTable('twin_maps', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).unique().notNull(),
  name: text('name').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  grid: jsonb('grid').notNull(),
  version: integer('version').default(1),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const twinRooms = pgTable('twin_rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  mapId: uuid('map_id').references(() => twinMaps.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  roomType: roomTypeEnum('room_type').notNull(),
  boundsX: integer('bounds_x').notNull(),
  boundsY: integer('bounds_y').notNull(),
  boundsW: integer('bounds_w').notNull(),
  boundsH: integer('bounds_h').notNull(),
  color: text('color'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const twinEntities = pgTable('twin_entities', {
  id: uuid('id').defaultRandom().primaryKey(),
  mapId: uuid('map_id').references(() => twinMaps.id, { onDelete: 'cascade' }).notNull(),
  roomId: uuid('room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  defId: text('def_id').notNull(),
  category: entityCategoryEnum('category').notNull(),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  orientation: orientationEnum('orientation').default('N'),
  layer: integer('layer').default(0),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  properties: jsonb('properties').default(sql`'{}'`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const twinActorStates = pgTable('twin_actor_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityId: uuid('entity_id').references(() => twinEntities.id, { onDelete: 'cascade' }).unique().notNull(),
  currentRoomId: uuid('current_room_id').references(() => twinRooms.id, { onDelete: 'set null' }),
  tileX: real('tile_x').notNull(),
  tileY: real('tile_y').notNull(),
  posture: actorPostureEnum('posture').default('standing'),
  behaviorState: behaviorStateEnum('behavior_state').default('idle'),
  activeInstruction: jsonb('active_instruction'),
  instructionQueue: jsonb('instruction_queue').default(sql`'[]'`),
  targetTileX: real('target_tile_x'),
  targetTileY: real('target_tile_y'),
  path: jsonb('path'),
  pathProgress: real('path_progress').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const twinBehaviorRules = pgTable('twin_behavior_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  ruleType: behaviorRuleTypeEnum('rule_type').notNull(),
  name: text('name').notNull(),
  triggerTime: time('trigger_time'),
  triggerCondition: jsonb('trigger_condition'),
  actions: jsonb('actions').notNull(),
  priority: integer('priority').default(0),
  isEnabled: boolean('is_enabled').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
