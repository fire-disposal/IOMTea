import { TRPCError } from '@trpc/server'
import { createFromTemplate, unpackGrid, detectRooms } from '@iomtea/shared-types'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { homeMaps, homeThings } from '../../db/schema/home-map'
import { usersPin } from '../../db/schema/pin'
import { publicProcedure, protectedProcedure, router } from '../index'

const thingInputSchema = z.object({
  thingType: z.string(),
  tileX: z.number().int().min(0),
  tileY: z.number().int().min(0),
  tileW: z.number().int().min(1).default(1),
  tileH: z.number().int().min(1).default(1),
  rotation: z.number().int().min(0).max(3).default(0),
  deviceId: z.string().uuid().nullable().default(null),
  tags: z.record(z.any()).default({}),
})

export const homeMapRouter = router({
  generateFromTemplate: protectedProcedure
    .input(z.object({
      patientId: z.string().uuid(),
      templateId: z.enum(['studio', 'one_bedroom', 'two_bedroom', 'three_bedroom']),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = createFromTemplate(input.templateId, { patientId: input.patientId })
      if (!result) throw new TRPCError({ code: 'NOT_FOUND', message: '模板不存在' })

      const [map] = await ctx.db.insert(homeMaps).values({
        patientId: input.patientId,
        templateId: input.templateId,
        packedGrid: result.map.packedGrid,
      }).returning()

      if (result.things.length > 0) {
        await ctx.db.insert(homeThings).values(
          result.things.map(({ id, ...t }) => ({ ...t, mapId: map.id }))
        )
      }

      return { map, things: result.things }
    }),

  getByPatient: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [map] = await ctx.db.select().from(homeMaps)
        .where(eq(homeMaps.patientId, input.patientId))
        .limit(1)
      if (!map) return null

      const things = await ctx.db.select().from(homeThings)
        .where(eq(homeThings.mapId, map.id))

      return { map, things }
    }),

  updateGrid: protectedProcedure
    .input(z.object({
      mapId: z.string().uuid(),
      packedGrid: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(homeMaps)
        .set({ packedGrid: input.packedGrid, updatedAt: new Date() })
        .where(eq(homeMaps.id, input.mapId))
        .returning()
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: '地图不存在' })
      return updated
    }),

  placeThing: protectedProcedure
    .input(z.object({
      mapId: z.string().uuid(),
      thing: thingInputSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const [thing] = await ctx.db.insert(homeThings).values({
        mapId: input.mapId,
        ...input.thing,
      }).returning()
      return thing
    }),

  roomsByPin: publicProcedure
    .input(z.object({ pin: z.string().min(4).max(6) }))
    .query(async ({ ctx, input }) => {
      const pinRows = await ctx.db.select().from(usersPin).where(eq(usersPin.pin, input.pin)).limit(1)
      if (pinRows.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'PIN 不存在' })

      const userId = pinRows[0].userId
      const { patients } = await import('../../db/schema')
      const patientRows = await ctx.db.select().from(patients).where(eq(patients.userId, userId)).limit(1)

      if (patientRows.length === 0) {
        return []
      }

      const mapRows = await ctx.db.select().from(homeMaps).where(eq(homeMaps.patientId, patientRows[0].id)).limit(1)
      if (mapRows.length === 0) return []

      const grid = unpackGrid(mapRows[0].packedGrid)
      const thingRows = await ctx.db.select().from(homeThings).where(eq(homeThings.mapId, mapRows[0].id))
      const { rooms } = detectRooms(grid, thingRows.map((t) => ({ id: t.id, thingType: t.thingType, tileX: t.tileX, tileY: t.tileY })))

      return rooms.map((r) => ({
        id: r.id,
        name: r.label || r.type,
        type: r.type,
        tileCount: r.tiles.length,
      }))
    }),

})
