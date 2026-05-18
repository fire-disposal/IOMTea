import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { patients } from '../../db/schema'
import { usersPin } from '../../db/schema/pin'
import { publicProcedure, protectedProcedure, router } from '../index'
import { twinState, type CoverageReport } from '../../../twin/twin-state'

const roomSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(['bedroom', 'livingroom', 'kitchen', 'bathroom', 'study', 'corridor', 'entry', 'balcony', 'storage', 'dining']),
  x: z.number().default(0),
  y: z.number().default(0),
  connections: z.array(z.string()).default([]),
})

const graphSchema = z.object({
  rooms: z.array(roomSchema).default([]),
  entryRoomId: z.string().nullable().default(null),
  personLocation: z.string().nullable().default(null),
})

export const homeGraphRouter = router({
  get: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [p] = await ctx.db.select({ tags: patients.tags }).from(patients).where(eq(patients.id, input.patientId)).limit(1)
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: '患者不存在' })
      const tags = (p.tags as Record<string, unknown>) || {}
      const graph = ((tags.homeGraph as any) || null) as any

      if (graph?.rooms) {
        twinState.initRooms(
          graph.rooms.map((r: any) => ({ id: r.id, name: r.name })),
          graph.rooms.map((r: any) => ({ id: r.id, connections: r.connections ?? [], hasCamera: r.hasCamera ?? false })),
        )
        graph.personLocation = twinState.getCurrentLocation() ?? graph.personLocation
      }

      return {
        ...(graph || { rooms: [], entryRoomId: null, personLocation: null }),
        trajectory: twinState.getRecentTrajectory(20),
        roomStates: twinState.getAllRooms(),
        coverage: twinState.getCoverageAnalysis(),
      }
    }),

  upsert: protectedProcedure
    .input(z.object({ patientId: z.string().uuid(), graph: graphSchema }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await ctx.db.select({ tags: patients.tags }).from(patients).where(eq(patients.id, input.patientId)).limit(1)
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: '患者不存在' })
      const currentTags = (p.tags as Record<string, unknown>) || {}
      const newTags = { ...currentTags, homeGraph: input.graph }
      await ctx.db.update(patients).set({ tags: newTags as any }).where(eq(patients.id, input.patientId))
      return { success: true }
    }),

  reportDeviceEvent: publicProcedure
    .input(z.object({
      pin: z.string().min(4).max(6),
      event: z.enum(['roomEnter', 'roomExit', 'actionDetected', 'fallDetected', 'presenceUpdate']),
      roomId: z.string().optional(),
      personPresent: z.boolean().optional(),
      action: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pinRows = await ctx.db.select().from(usersPin).where(eq(usersPin.pin, input.pin)).limit(1)
      if (pinRows.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'PIN 不存在' })

      const userId = pinRows[0].userId
      const patientRows = await ctx.db.select({ id: patients.id, tags: patients.tags }).from(patients).where(eq(patients.userId, userId)).limit(1)
      if (patientRows.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: '未找到关联患者' })

      const patient = patientRows[0]
      const tags = (patient.tags as Record<string, unknown>) || {}
      const graph = ((tags.homeGraph as any) || {}) as any

      const rooms = graph.rooms || []
      twinState.initRooms(
        rooms.map((r: any) => ({ id: r.id, name: r.name })),
        rooms.map((r: any) => ({ id: r.id, connections: r.connections ?? [], hasCamera: r.hasCamera ?? false })),
      )

      let result: any = { success: true }

      if (input.event === 'presenceUpdate' && input.roomId) {
        const added = input.personPresent === true
        result = twinState.reportPresence(input.roomId, added, input.pin)
      } else if (input.event === 'roomEnter' && input.roomId) {
        result = twinState.reportPresence(input.roomId, true, input.pin)
      } else if (input.event === 'roomExit' && input.roomId) {
        result = twinState.reportPresence(input.roomId, false, input.pin)
      }

      graph.personLocation = twinState.getCurrentLocation()
      const newTags = { ...tags, homeGraph: graph }
      await ctx.db.update(patients).set({ tags: newTags as any }).where(eq(patients.id, patient.id))

      return {
        success: true,
        personLocation: graph.personLocation,
        trajectory: twinState.getRecentTrajectory(10),
        ...result,
      }
    }),
})

export type HomeGraph = z.infer<typeof graphSchema>