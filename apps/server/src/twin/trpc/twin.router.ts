import {
  mapCreateSchema,
  mapUpdateSchema,
  mapGetSchema,
  roomCreateSchema,
  roomUpdateSchema,
  entityCreateSchema,
  entityUpdateSchema,
  entityListInputSchema,
  instructionSchema,
  behaviorListInputSchema,
  behaviorCreateSchema,
  behaviorUpdateSchema,
  activityListInputSchema,
  cvDetectionListInputSchema,
} from '@iomtea/shared-types'
import { z } from 'zod'
import { eq, desc, and, gt } from 'drizzle-orm'
import { protectedProcedure, router } from '../../core/trpc/index'
import { twinMaps, twinRooms, twinEntities, twinActorStates, twinBehaviorRules, twinActivityLog, twinCvDetections, events } from '../../core/db'
import { loadMapData, saveActivityLog, saveActorState } from '../db-writer'
import { createEngine, startEngine, stopEngine, setSpeed, getEngineStatus, listEngines, getEngine, injectScenario, type PatientEngine } from '../engine'
import { SCENARIO_TYPES } from '../types'
import type { ActorState } from '../behavior'
import { enqueueInstruction } from '../instruction'
import { broadcastManager } from '../../core/realtime/broadcast'

export const engines = new Map<string, PatientEngine>()

function buildGrid(mapData: Awaited<ReturnType<typeof loadMapData>>): number[][] {
  const { map, rooms, entities } = mapData
  const grid: number[][] = Array.from({ length: map.height }, () =>
    Array.from({ length: map.width }, () => 0),
  )

  for (const room of rooms) {
    for (let y = room.boundsY; y < room.boundsY + room.boundsH && y < map.height; y++) {
      for (let x = room.boundsX; x < room.boundsX + room.boundsW && x < map.width; x++) {
        grid[y][x] = 1
      }
    }
  }

  for (const entity of entities) {
    if (entity.defId === 'door') {
      const x = entity.gridX
      const y = entity.gridY
      if (y >= 0 && y < map.height && x >= 0 && x < map.width) {
        grid[y][x] = 2
      }
    }
  }

    return grid
}

async function handleTriggerEvents(db: any, engine: PatientEngine): Promise<void> {
  const since = new Date(Date.now() - 5000)
  try {
    const recentEvents = await db.select().from(events)
      .where(and(
        eq(events.kind, 'behavior' as any),
        gt(events.createdAt as any, since),
      ))
      .orderBy(desc(events.recordedAt))
      .limit(10)

    for (const evt of recentEvents) {
      const actors = Array.from(engine.actors.values())
      if (actors.length === 0) continue
      const actor = actors[0]

      if (evt.metric === 'medication_missed') {
        const kitchenRoom = engine.navGraph.rooms.find((r: any) =>
          r.name.includes('厨房') || r.name.includes('kitchen') || r.name.includes('餐厅') || r.name.includes('客厅')
        )
        if (kitchenRoom) {
          enqueueInstruction(actor, {
            id: crypto.randomUUID(),
            type: 'move_to_room',
            actorEntityId: actor.entityId,
            params: { type: 'move_to_room', room: kitchenRoom.roomId },
            priority: 5,
            preemptible: true,
          })
        }
      }

      if (evt.metric === 'bed_exit') {
        enqueueInstruction(actor, {
          id: crypto.randomUUID(),
          type: 'change_posture',
          actorEntityId: actor.entityId,
          params: { type: 'change_posture', posture: 'standing' },
          priority: 3,
          preemptible: true,
        })
      }
    }
  } catch {
    // Best-effort: ignore trigger processing failures
  }
}

export const twinRouter = router({
  maps: router({
    get: protectedProcedure.input(mapGetSchema).query(async ({ ctx, input }) => {
      if (input.id) {
        return (await loadMapData(ctx.db as any, input.id)).map
      }
      return null
    }),

    create: protectedProcedure.input(mapCreateSchema).mutation(async ({ ctx, input }) => {
      const [map] = await (ctx.db as any).insert(twinMaps).values({
        patientId: input.patientId,
        name: input.name,
        width: input.width,
        height: input.height,
        grid: input.grid,
      }).returning()
      return map
    }),

    update: protectedProcedure.input(mapUpdateSchema).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const [updated] = await (ctx.db as any).update(twinMaps).set(data).where(eq(twinMaps.id, id)).returning()
      return updated
    }),
  }),

  rooms: router({
    list: protectedProcedure.input(z.object({ mapId: z.string().uuid() })).query(async ({ ctx, input }) => {
      return (ctx.db as any).select().from(twinRooms).where(eq(twinRooms.mapId, input.mapId))
    }),

    create: protectedProcedure.input(roomCreateSchema).mutation(async ({ ctx, input }) => {
      const [room] = await (ctx.db as any).insert(twinRooms).values(input).returning()
      return room
    }),

    update: protectedProcedure.input(roomUpdateSchema).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const [updated] = await (ctx.db as any).update(twinRooms).set(data).where(eq(twinRooms.id, id)).returning()
      return updated
    }),

    delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      await (ctx.db as any).delete(twinRooms).where(eq(twinRooms.id, input.id))
      return { success: true }
    }),
  }),

  entities: router({
    list: protectedProcedure.input(entityListInputSchema).query(async ({ ctx, input }) => {
      const conditions = [eq(twinEntities.mapId, input.mapId)]
      if (input.category) conditions.push(eq(twinEntities.category, input.category as any))
      if (input.roomId) conditions.push(eq(twinEntities.roomId, input.roomId))
      return (ctx.db as any).select().from(twinEntities).where(conditions.length === 1 ? conditions[0] : undefined)
    }),

    create: protectedProcedure.input(entityCreateSchema).mutation(async ({ ctx, input }) => {
      const [entity] = await (ctx.db as any).insert(twinEntities).values(input as any).returning()
      return entity
    }),

    update: protectedProcedure.input(entityUpdateSchema).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const [updated] = await (ctx.db as any).update(twinEntities).set(data).where(eq(twinEntities.id, id)).returning()
      return updated
    }),

    delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      await (ctx.db as any).delete(twinEntities).where(eq(twinEntities.id, input.id))
      return { success: true }
    }),
  }),

  actor: router({
    getState: protectedProcedure.input(z.object({ entityId: z.string().uuid() })).query(async ({ ctx, input }) => {
      const rows = await (ctx.db as any).select().from(twinActorStates).where(eq(twinActorStates.entityId, input.entityId)).limit(1)
      return rows[0] ?? null
    }),

    instruction: protectedProcedure.input(instructionSchema).mutation(async ({ ctx, input }) => {
      for (const [mapId, engine] of engines) {
        const actor = engine.actors.get(input.actorEntityId)
        if (actor) {
          enqueueInstruction(actor, {
            id: crypto.randomUUID(),
            type: input.type,
            actorEntityId: input.actorEntityId,
            params: input.params,
            priority: input.priority,
            preemptible: input.preemptible,
          })
          return { success: true, message: 'Instruction queued' }
        }
      }
      return { success: false, message: 'Actor not found in any running engine' }
    }),
  }),

  behaviors: router({
    list: protectedProcedure.input(behaviorListInputSchema).query(async ({ ctx, input }) => {
      return (ctx.db as any).select().from(twinBehaviorRules).where(eq(twinBehaviorRules.patientId, input.patientId))
    }),

    create: protectedProcedure.input(behaviorCreateSchema).mutation(async ({ ctx, input }) => {
      const [rule] = await (ctx.db as any).insert(twinBehaviorRules).values(input as any).returning()
      return rule
    }),

    update: protectedProcedure.input(behaviorUpdateSchema).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const [updated] = await (ctx.db as any).update(twinBehaviorRules).set(data).where(eq(twinBehaviorRules.id, id)).returning()
      return updated
    }),

    delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      await (ctx.db as any).delete(twinBehaviorRules).where(eq(twinBehaviorRules.id, input.id))
      return { success: true }
    }),

    toggle: protectedProcedure.input(z.object({ id: z.string().uuid(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const [updated] = await (ctx.db as any).update(twinBehaviorRules)
        .set({ isEnabled: input.enabled })
        .where(eq(twinBehaviorRules.id, input.id))
        .returning()
      return updated
    }),
  }),

  activity: router({
    list: protectedProcedure.input(activityListInputSchema).query(async ({ ctx, input }) => {
      if (input.actorEntityId) {
        return (ctx.db as any).select().from(twinActivityLog)
          .where(eq(twinActivityLog.actorEntityId, input.actorEntityId))
          .orderBy(desc(twinActivityLog.recordedAt))
          .limit(input.limit)
      }
      return []
    }),
  }),

  cv: router({
    ingest: protectedProcedure
      .input(z.object({
        cameraId: z.string(),
        patientId: z.string().uuid(),
        detectedClass: z.string(),
        confidence: z.number().min(0).max(1),
        bbox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
        timestamp: z.number().optional(),
        snapshot: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { handleCvDetection } = await import('../../ingest/cv-bridge')
        const result = await handleCvDetection(ctx.db as any, engines, {
          cameraId: input.cameraId,
          patientId: input.patientId,
          detectedClass: input.detectedClass,
          confidence: input.confidence,
          bbox: input.bbox,
          timestamp: input.timestamp ?? Date.now(),
          snapshotUrl: input.snapshot,
        })
        return { success: true, eventId: result.eventId, synced: result.synced }
      }),

    detections: protectedProcedure.input(cvDetectionListInputSchema).query(async ({ ctx, input }) => {
      const conditions = []
      if (input.patientId) conditions.push(eq(twinCvDetections.patientId, input.patientId))
      if (input.mapId) conditions.push(eq(twinCvDetections.mapId, input.mapId))
      return (ctx.db as any).select().from(twinCvDetections)
        .where(undefined)
        .limit(input.limit)
    }),

    latest: protectedProcedure.input(z.object({ patientId: z.string().uuid() })).query(async ({ ctx, input }) => {
      return (ctx.db as any).select().from(twinCvDetections)
        .where(eq(twinCvDetections.patientId, input.patientId))
        .orderBy(desc(twinCvDetections.detectedAt))
        .limit(1)
    }),
  }),

  engine: router({
    start: protectedProcedure.input(z.object({
      profileId: z.string().optional().default('elderly-cardiac'),
      name: z.string().optional().default('Simulated Patient'),
      mapId: z.string().uuid().optional(),
      speed: z.number().min(0.1).max(60).optional().default(1),
    })).mutation(async ({ ctx, input }) => {
      const engine = await createEngine(ctx.db as any, {
        profileId: input.profileId,
        name: input.name,
        mapId: input.mapId,
        speed: input.speed,
      })
      await startEngine(ctx.db as any, engine.patientId)
      const engineRef = getEngine(engine.patientId)
      if (engineRef && input.mapId) {
        engines.set(input.mapId, engineRef)
      }
      return getEngineStatus(engine.patientId)
    }),

    stop: protectedProcedure.input(z.object({ patientId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      stopEngine(input.patientId)
      return { success: true }
    }),

    pause: protectedProcedure.input(z.object({ patientId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      stopEngine(input.patientId)
      return { success: true }
    }),

    resume: protectedProcedure.input(z.object({ patientId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      await startEngine(ctx.db as any, input.patientId)
      return { success: true }
    }),

    setSpeed: protectedProcedure
      .input(z.object({ patientId: z.string().uuid(), speed: z.number().min(0.1).max(60) }))
      .mutation(async ({ ctx, input }) => {
        const ok = setSpeed(input.patientId, input.speed)
        return { success: ok, speed: input.speed }
      }),

    status: protectedProcedure
      .input(z.object({ patientId: z.string().uuid().optional() }))
      .query(async ({ ctx, input }) => {
        if (input.patientId) {
          return getEngineStatus(input.patientId) ?? null
        }
        const all = listEngines()
        return all.map((e) => getEngineStatus(e.patientId)).filter(Boolean)
      }),

    injectScenario: protectedProcedure
      .input(z.object({ patientId: z.string().uuid(), type: z.enum(SCENARIO_TYPES) }))
      .mutation(async ({ ctx, input }) => {
        const ok = await injectScenario(ctx.db as any, input.patientId, input.type)
        return { success: ok }
      }),

    delete: protectedProcedure.input(z.object({ patientId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      stopEngine(input.patientId)
      const engine = getEngine(input.patientId)
      if (engine?.mapId) {
        engines.delete(engine.mapId)
      }
      return { success: true }
    }),
  }),
})
