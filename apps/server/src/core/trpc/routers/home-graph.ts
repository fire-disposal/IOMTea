import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { events, patients, devices } from '../../db/schema.js'
import { usersPin } from '../../db/schema/pin'
import { publicProcedure, protectedProcedure, router } from '../index'
import { twinState } from '../../../twin/twin-state'
import { broadcastManager } from '../../realtime/broadcast'
import { createChildLogger } from '../../lib/logger'

const logger = createChildLogger('home-graph')

const roomSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum([
    'bedroom',
    'livingroom',
    'kitchen',
    'bathroom',
    'study',
    'corridor',
    'entry',
    'balcony',
    'storage',
    'dining',
  ]),
  x: z.number().default(0),
  y: z.number().default(0),
  connections: z.array(z.string()).default([]),
  hasCamera: z.boolean().default(false),
  devices: z
    .array(
      z.object({
        id: z.string(),
        serialNumber: z.string(),
        deviceType: z.string(),
        status: z.string(),
        pin: z.string().optional(),
      }),
    )
    .default([]),
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
      const [p] = await ctx.db
        .select({ tags: patients.tags })
        .from(patients)
        .where(eq(patients.id, input.patientId))
        .limit(1)
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: '患者不存在' })
      const tags = (p.tags as Record<string, unknown>) || {}
      const graph = ((tags.homeGraph as any) || null) as any

      if (graph?.rooms) {
        const allDevices = await ctx.db
          .select({
            id: devices.id,
            serialNumber: devices.serialNumber,
            deviceType: devices.deviceType,
            status: devices.status,
            roomId: devices.roomId,
            tags: devices.tags,
          })
          .from(devices)
          .where(eq(devices.patientId, input.patientId))

        const pinDevicesForGraph = await ctx.db
          .select({
            pin: usersPin.pin,
            roomId: usersPin.roomId,
            nickname: usersPin.nickname,
            lastSeenAt: usersPin.lastSeenAt,
          })
          .from(usersPin)
          .innerJoin(patients, eq(patients.userId, usersPin.userId))
          .where(eq(patients.id, input.patientId))

        for (const room of graph.rooms) {
          const roomDevices = allDevices
            .filter((d: any) => d.roomId === room.id)
            .map((d: any) => ({
              id: d.id,
              serialNumber: d.serialNumber,
              deviceType: d.deviceType,
              status: d.status,
            }))

          const pinDevices = pinDevicesForGraph
            .filter((p: any) => p.roomId === room.id)
            .map((p: any) => ({
              id: p.pin,
              serialNumber: p.pin,
              deviceType: 'pin',
              status: p.lastSeenAt ? 'active' : 'inactive',
              pin: p.pin,
              nickname: p.nickname,
            }))

          room.devices = [...roomDevices, ...pinDevices]
        }

        twinState.initRooms(
          graph.rooms.map((r: any) => ({ id: r.id, name: r.name })),
          graph.rooms.map((r: any) => ({
            id: r.id,
            connections: r.connections ?? [],
            hasCamera: r.hasCamera ?? false,
          })),
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
      const [p] = await ctx.db
        .select({ tags: patients.tags })
        .from(patients)
        .where(eq(patients.id, input.patientId))
        .limit(1)
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: '患者不存在' })
      const currentTags = (p.tags as Record<string, unknown>) || {}
      const newTags = { ...currentTags, homeGraph: input.graph }
      await ctx.db
        .update(patients)
        .set({ tags: newTags as any })
        .where(eq(patients.id, input.patientId))
      return { success: true }
    }),

  roomsByPin: publicProcedure
    .input(z.object({ pin: z.string().min(4).max(6) }))
    .query(async ({ ctx, input }) => {
      const pinRows = await ctx.db
        .select()
        .from(usersPin)
        .where(eq(usersPin.pin, input.pin))
        .limit(1)
      if (pinRows.length === 0) return []
      const userId = pinRows[0].userId
      const patientRows = await ctx.db
        .select({ tags: patients.tags })
        .from(patients)
        .where(eq(patients.userId, userId))
        .limit(1)
      if (patientRows.length === 0) return []
      const tags = (patientRows[0].tags as Record<string, unknown>) || {}
      const graph = tags.homeGraph as any
      return (graph?.rooms || []).map((r: any) => ({
        id: r.id,
        name: r.name || r.id,
        type: r.type || 'bedroom',
        hasCamera: r.hasCamera ?? false,
        connections: r.connections ?? [],
      }))
    }),

  reportDeviceEvent: publicProcedure
    .input(
      z.object({
        pin: z.string().min(4).max(6),
        event: z.enum([
          'roomEnter',
          'roomExit',
          'actionDetected',
          'fallDetected',
          'presenceUpdate',
          'healthObservation',
          'healthAlert',
        ]),
        roomId: z.string().optional(),
        personPresent: z.boolean().optional(),
        action: z.string().optional(),
        metric: z.string().optional(),
        value: z.number().optional(),
        unit: z.string().optional(),
        source: z.enum(['iot', 'cv', 'simulator', 'manual']).optional(),
        severity: z.enum(['critical', 'warning', 'info']).optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pinRows = await ctx.db
        .select()
        .from(usersPin)
        .where(eq(usersPin.pin, input.pin))
        .limit(1)
      if (pinRows.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'PIN 不存在' })

      const userId = pinRows[0].userId
      const patientRows = await ctx.db
        .select({ id: patients.id, tags: patients.tags })
        .from(patients)
        .where(eq(patients.userId, userId))
        .limit(1)
      if (patientRows.length === 0)
        throw new TRPCError({ code: 'NOT_FOUND', message: '未找到关联患者' })

      const patient = patientRows[0]
      const tags = (patient.tags as Record<string, unknown>) || {}
      const graph = ((tags.homeGraph as any) || {}) as any

      const rooms = graph.rooms || []
      twinState.initRooms(
        rooms.map((r: any) => ({ id: r.id, name: r.name })),
        rooms.map((r: any) => ({
          id: r.id,
          connections: r.connections ?? [],
          hasCamera: r.hasCamera ?? false,
        })),
      )

      let result: any = { success: true }

      if (input.event === 'presenceUpdate' && input.roomId) {
        const added = input.personPresent === true
        result = twinState.reportPresence(input.roomId, added, input.pin)
      } else if (input.event === 'roomEnter' && input.roomId) {
        result = twinState.reportPresence(input.roomId, true, input.pin)
      } else if (input.event === 'roomExit' && input.roomId) {
        result = twinState.reportPresence(input.roomId, false, input.pin)
      } else if (input.event === 'fallDetected') {
        await ctx.db
          .insert(events)
          .values({
            patientId: patient.id,
            pinCode: input.pin,
            kind: 'alert',
            metric: 'fall_detected',
            value: null,
            severity: 'critical',
            status: 'active',
            source: 'iot',
            tags: { ...(input.metadata || {}), pin: input.pin },
            recordedAt: new Date(),
          } as any)
          .catch(() => {})
        result = { event: 'fallDetected', severity: 'critical' }
      } else if (input.event === 'actionDetected') {
        await ctx.db
          .insert(events)
          .values({
            patientId: patient.id,
            pinCode: input.pin,
            kind: 'observation',
            metric: 'action',
            value: null,
            source: 'iot',
            tags: {
              action: input.action,
              roomId: input.roomId,
              ...(input.metadata || {}),
              pin: input.pin,
            },
            recordedAt: new Date(),
          } as any)
          .catch(() => {})
        result = { event: 'actionDetected', action: input.action }
      } else if (input.event === 'healthObservation' && input.metric) {
        await ctx.db
          .insert(events)
          .values({
            patientId: patient.id,
            pinCode: input.pin,
            kind: 'observation',
            metric: input.metric,
            value: input.value ?? null,
            unit: input.unit ?? undefined,
            source: (input.source || 'simulator') as any,
            tags: { ...(input.metadata || {}), pin: input.pin },
            recordedAt: new Date(),
          } as any)
          .catch(() => {})

        broadcastManager.broadcastVitals(patient.id, [{
          metric: input.metric,
          value: input.value ?? null,
          unit: input.unit ?? null,
        }])

        result = { event: 'healthObservation', metric: input.metric, value: input.value }
      } else if (input.event === 'healthAlert' && input.metric) {
        await ctx.db
          .insert(events)
          .values({
            patientId: patient.id,
            pinCode: input.pin,
            kind: 'alert',
            metric: input.metric,
            value: input.value ?? null,
            unit: input.unit ?? undefined,
            severity: (input.severity || 'warning') as any,
            status: 'active' as any,
            source: (input.source || 'simulator') as any,
            tags: { ...(input.metadata || {}), pin: input.pin },
            recordedAt: new Date(),
          } as any)
          .catch(() => {})

        broadcastManager.broadcastVitals(patient.id, [{
          metric: input.metric,
          value: input.value ?? null,
          unit: input.unit ?? null,
        }])
        result = { event: 'healthAlert', metric: input.metric, severity: input.severity }
      }

      graph.personLocation = twinState.getCurrentLocation()
      const newTags = { ...tags, homeGraph: graph }
      await ctx.db
        .update(patients)
        .set({ tags: newTags as any })
        .where(eq(patients.id, patient.id))

      if (result.changed && graph.personLocation) {
        broadcastManager.broadcastPersonLocation(patient.id, {
          roomId: graph.personLocation,
          fromRoomId: result.fromRoom,
          path: result.path,
          event: result.event ?? 'update',
          timestamp: Date.now(),
        })
      }

      return {
        success: true,
        personLocation: graph.personLocation,
        trajectory: twinState.getRecentTrajectory(10),
        ...result,
      }
    }),
})

export type HomeGraph = z.infer<typeof graphSchema>
