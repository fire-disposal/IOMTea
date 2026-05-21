import { TRPCError } from '@trpc/server'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { events, patients, devices } from '../../db/schema'
import { usersPin } from '../../db/schema/pin'
import { protectedProcedure, router } from '../index'

const roomLayoutSchema = z.object({
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
  x: z.number(),
  y: z.number(),
  connections: z.array(z.string()).default([]),
  patientId: z.string().uuid().optional(),
})

const graphLayoutSchema = z.object({
  rooms: z.array(roomLayoutSchema),
})

export const nodeGraphRouter = router({
  getGraph: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId
    const allPatients = await ctx.db
      .select({
        id: patients.id,
        name: patients.name,
        tags: patients.tags,
      })
      .from(patients)
      .where(eq(patients.userId, userId))

    const allDevices = await ctx.db
      .select({
        id: devices.id,
        serialNumber: devices.serialNumber,
        deviceType: devices.deviceType,
        status: devices.status,
        roomId: devices.roomId,
        patientId: devices.patientId,
        lastSeenAt: devices.lastSeenAt,
        tags: devices.tags,
      })
      .from(devices)

    const allPins = await ctx.db
      .select({
        pin: usersPin.pin,
        label: usersPin.label,
        nickname: usersPin.nickname,
        roomId: usersPin.roomId,
        isVirtual: usersPin.isVirtual,
        lastSeenAt: usersPin.lastSeenAt,
        generatorConfig: usersPin.generatorConfig,
      })
      .from(usersPin)
      .where(eq(usersPin.userId, userId))

    const rooms: any[] = []
    const seenRoomIds = new Set<string>()

    for (const patient of allPatients) {
      const tags = (patient.tags as Record<string, unknown>) || {}
      const graph = tags.homeGraph as any

      if (graph?.rooms) {
        for (const r of graph.rooms) {
          if (seenRoomIds.has(r.id)) continue
          seenRoomIds.add(r.id)

          const roomDevices = allDevices
            .filter((d: any) => d.roomId === r.id)
            .map((d: any) => ({
              id: d.id,
              serialNumber: d.serialNumber,
              deviceType: d.deviceType,
              status: d.status,
              lastSeenAt: d.lastSeenAt,
            }))

          const roomPins = allPins
            .filter((p: any) => p.roomId === r.id)
            .map((p: any) => ({
              id: p.pin,
              label: p.label ?? p.nickname ?? p.pin,
              deviceType: p.isVirtual ? 'virtual' : 'pin',
              status: p.lastSeenAt ? 'active' : 'inactive',
              lastSeenAt: p.lastSeenAt,
              pin: p.pin,
            }))

          rooms.push({
            ...r,
            patientId: r.patientId || patient.id,
            patientName: patient.name,
            devices: [...roomDevices, ...roomPins],
          })
        }
      }
    }

    const allAssignedDeviceIds = new Set(rooms.flatMap((r: any) => r.devices.map((d: any) => d.id)))
    const unassignedDevices = [
      ...allDevices
        .filter((d: any) => !d.roomId)
        .map((d: any) => ({
          id: d.id,
          serialNumber: d.serialNumber,
          deviceType: d.deviceType,
          status: d.status,
          lastSeenAt: d.lastSeenAt,
          patientId: d.patientId,
        })),
      ...allPins
        .filter((p: any) => !p.roomId)
        .map((p: any) => ({
          id: p.pin,
          label: p.label ?? p.nickname ?? p.pin,
          deviceType: p.isVirtual ? 'virtual' : 'pin',
          status: p.lastSeenAt ? 'active' : 'inactive',
          lastSeenAt: p.lastSeenAt,
        })),
    ]

    const latestEvents = await ctx.db
      .select({
        patientId: events.patientId,
        metric: events.metric,
        value: events.value,
        unit: events.unit,
        recordedAt: events.recordedAt,
      })
      .from(events)
      .where(eq(events.kind, 'observation' as any))
      .orderBy(desc(events.recordedAt))
      .limit(200)

    const patientEvents = new Map<string, any[]>()
    const seenEvents = new Set<string>()
    for (const e of latestEvents) {
      if (!patientEvents.has(e.patientId)) {
        patientEvents.set(e.patientId, [])
      }
      const key = `${e.patientId}-${e.metric}`
      if (!seenEvents.has(key)) {
        seenEvents.add(key)
        patientEvents.get(e.patientId)!.push({
          metric: e.metric,
          value: e.value,
          unit: e.unit,
          recordedAt: e.recordedAt,
        })
        if (patientEvents.get(e.patientId)!.length >= 5) break
      }
    }

    return {
      rooms,
      unassignedDevices,
      patients: allPatients.map((p: any) => ({
        id: p.id,
        name: p.name,
        latestVitals: patientEvents.get(p.id)?.slice(0, 5) ?? [],
      })),
    }
  }),

  saveGraph: protectedProcedure
    .input(z.object({ graph: graphLayoutSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId
      const roomToPatient = new Map<string, string>()

      for (const room of input.graph.rooms) {
        if (room.patientId) {
          roomToPatient.set(room.id, room.patientId)
        }
      }

      const pts = await ctx.db
        .select({
          id: patients.id,
          tags: patients.tags,
        })
        .from(patients)
        .where(eq(patients.userId, userId))

      for (const p of pts) {
        const tags = (p.tags as Record<string, unknown>) || {}
        const graph = (tags.homeGraph as any) || {
          rooms: [],
          entryRoomId: null,
          personLocation: null,
        }

        const ownerRoomsInput = input.graph.rooms.filter((r) => {
          if (r.patientId) return r.patientId === p.id
          const existingRoom = graph.rooms?.find((gr: any) => gr.id === r.id)
          return existingRoom != null
        })

        const existingRooms = (graph.rooms || []) as any[]
        const updatedRooms = ownerRoomsInput.map((r) => {
          const existing = existingRooms.find((er: any) => er.id === r.id)
          return {
            id: r.id,
            name: r.name,
            type: r.type,
            x: r.x,
            y: r.y,
            connections: r.connections,
            hasCamera: existing?.hasCamera ?? false,
            devices: existing?.devices ?? [],
          }
        })

        const newTags = { ...tags, homeGraph: { ...graph, rooms: updatedRooms } }
        await ctx.db
          .update(patients)
          .set({ tags: newTags as any })
          .where(eq(patients.id, p.id))
      }

      return { success: true }
    }),

  assignDevice: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        roomId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        input.deviceId,
      )

      if (isUuid) {
        const [dev] = await ctx.db
          .select({ id: devices.id })
          .from(devices)
          .where(eq(devices.id, input.deviceId))
          .limit(1)
        if (!dev) throw new TRPCError({ code: 'NOT_FOUND', message: '设备不存在' })
        await ctx.db
          .update(devices)
          .set({ roomId: input.roomId })
          .where(eq(devices.id, input.deviceId))
      } else {
        await ctx.db
          .update(usersPin)
          .set({ roomId: input.roomId })
          .where(eq(usersPin.pin, input.deviceId))
      }

      return { success: true }
    }),

  deleteRoom: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId
      const pts = await ctx.db
        .select({
          id: patients.id,
          tags: patients.tags,
        })
        .from(patients)
        .where(eq(patients.userId, userId))

      for (const p of pts) {
        const tags = (p.tags as Record<string, unknown>) || {}
        const graph = tags.homeGraph as any
        if (!graph?.rooms) continue

        const updatedRooms = graph.rooms.filter((r: any) => r.id !== input.roomId)
        const updatedConnections = (graph.rooms || [])
          .map((r: any) => ({
            ...r,
            connections: (r.connections || []).filter((c: string) => c !== input.roomId),
          }))
          .filter((r: any) => r.id !== input.roomId)

        if (updatedRooms.length !== graph.rooms.length) {
          const newTags = { ...tags, homeGraph: { ...graph, rooms: updatedConnections } }
          await ctx.db
            .update(patients)
            .set({ tags: newTags as any })
            .where(eq(patients.id, p.id))
        }
      }

      await ctx.db
        .update(devices)
        .set({ roomId: null as any })
        .where(eq(devices.roomId, input.roomId))
      await ctx.db
        .update(usersPin)
        .set({ roomId: null as any })
        .where(eq(usersPin.roomId, input.roomId))

      return { success: true }
    }),
})

export type NodeGraph = z.infer<typeof graphLayoutSchema>
