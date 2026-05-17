import {
  mapCreateSchema,
  mapUpdateSchema,
  mapGetSchema,
  entityListInputSchema,
} from '@iomtea/shared-types'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { protectedProcedure, router } from '../../core/trpc/index'
import { requirePermission } from '../../core/trpc/middleware/rbac'
import { twinMaps, twinRooms, twinEntities } from '../../core/db'
import { loadMapData } from '../db-writer'
import { createEngine, startEngine, stopEngine, setSpeed, getEngineStatus, listEngines, getEngine, injectScenario, type PatientEngine } from '../engine'
import { SCENARIO_TYPES } from '../types'

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

export const twinRouter = router({
  maps: router({
    get: protectedProcedure
      .use(requirePermission('twin:read')).input(mapGetSchema).query(async ({ ctx, input }) => {
      if (input.id) {
        const data = await loadMapData(ctx.db as any, input.id)
        return data.map
      }
      if (input.patientId) {
        const rows = await (ctx.db as any).select().from(twinMaps).where(eq(twinMaps.patientId, input.patientId)).limit(1)
        if (rows.length === 0) return null
        const data = await loadMapData(ctx.db as any, rows[0].id)
        return data.map
      }
      return null
    }),

    create: protectedProcedure
      .use(requirePermission('twin:manage')).input(mapCreateSchema).mutation(async ({ ctx, input }) => {
      const [map] = await (ctx.db as any).insert(twinMaps).values({
        patientId: input.patientId,
        name: input.name,
        width: input.width,
        height: input.height,
        grid: input.grid,
      }).returning()
      return map
    }),

    update: protectedProcedure
      .use(requirePermission('twin:manage')).input(mapUpdateSchema).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const [updated] = await (ctx.db as any).update(twinMaps).set(data).where(eq(twinMaps.id, id)).returning()
      return updated
    }),
  }),

  rooms: router({
    list: protectedProcedure
      .use(requirePermission('twin:read')).input(z.object({ mapId: z.string().uuid() })).query(async ({ ctx, input }) => {
      return (ctx.db as any).select().from(twinRooms).where(eq(twinRooms.mapId, input.mapId))
    }),
  }),

  entities: router({
    list: protectedProcedure
      .use(requirePermission('twin:read')).input(entityListInputSchema).query(async ({ ctx, input }) => {
      const conditions = [eq(twinEntities.mapId, input.mapId)]
      if (input.category) conditions.push(eq(twinEntities.category, input.category as any))
      if (input.roomId) conditions.push(eq(twinEntities.roomId, input.roomId))
      return (ctx.db as any).select().from(twinEntities).where(conditions.length === 1 ? conditions[0] : undefined)
    }),
  }),

  engine: router({
    start: protectedProcedure
      .use(requirePermission('twin:manage')).input(z.object({
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

    stop: protectedProcedure
      .use(requirePermission('twin:manage')).input(z.object({ patientId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      stopEngine(input.patientId)
      return { success: true }
    }),

    pause: protectedProcedure
      .use(requirePermission('twin:manage')).input(z.object({ patientId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      stopEngine(input.patientId)
      return { success: true }
    }),

    resume: protectedProcedure
      .use(requirePermission('twin:manage')).input(z.object({ patientId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      await startEngine(ctx.db as any, input.patientId)
      return { success: true }
    }),

    setSpeed: protectedProcedure
      .use(requirePermission('twin:manage'))
      .input(z.object({ patientId: z.string().uuid(), speed: z.number().min(0.1).max(60) }))
      .mutation(async ({ ctx, input }) => {
        const ok = setSpeed(input.patientId, input.speed)
        return { success: ok, speed: input.speed }
      }),

    status: protectedProcedure
      .use(requirePermission('twin:read'))
      .input(z.object({ patientId: z.string().uuid().optional() }))
      .query(async ({ ctx, input }) => {
        if (input.patientId) {
          return getEngineStatus(input.patientId) ?? null
        }
        const all = listEngines()
        return all.map((e) => getEngineStatus(e.patientId)).filter(Boolean)
      }),

    injectScenario: protectedProcedure
      .use(requirePermission('twin:manage'))
      .input(z.object({ patientId: z.string().uuid(), type: z.enum(SCENARIO_TYPES) }))
      .mutation(async ({ ctx, input }) => {
        const ok = await injectScenario(ctx.db as any, input.patientId, input.type)
        return { success: ok }
      }),
  }),
})
