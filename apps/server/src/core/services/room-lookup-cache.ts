import { Thing, HomeMap, HomeMapRuntime, buildCache, type TagCompound } from '@iomtea/shared-types'
import { db } from '../db'
import { homeMaps, homeThings } from '../db/schema/home-map'
import { usersPin } from '../db/schema/pin'
import { eq } from 'drizzle-orm'

function toHomeMap(row: typeof homeMaps.$inferSelect): HomeMap {
  return {
    id: row.id,
    patientId: row.patientId,
    templateId: row.templateId,
    packedGrid: row.packedGrid,
    createdAt: row.createdAt?.toISOString() ?? '',
    updatedAt: row.updatedAt?.toISOString() ?? '',
  }
}

function toThing(row: typeof homeThings.$inferSelect): Thing {
  return {
    id: row.id,
    thingType: row.thingType,
    tileX: row.tileX,
    tileY: row.tileY,
    tileW: row.tileW ?? 1,
    tileH: row.tileH ?? 1,
    rotation: (row.rotation ?? 0) as 0 | 1 | 2 | 3,
    deviceId: row.deviceId,
    tags: (row.tags ?? {}) as TagCompound,
    config: (row.config ?? {}) as TagCompound,
  }
}

export class RoomLookupCache {
  private thingByDevice = new Map<string, Thing>()
  private thingByPin = new Map<string, Thing>()
  private runtimeByPatient = new Map<string, HomeMapRuntime>()
  private version = 0

  async rebuildAll(): Promise<void> {
    this.thingByDevice.clear()
    this.thingByPin.clear()
    this.runtimeByPatient.clear()

    const rows = await db.select().from(homeMaps)
    for (const row of rows) {
      const map = toHomeMap(row)
      const thingRows = await db.select().from(homeThings)
        .where(eq(homeThings.mapId, map.id))
      const things = thingRows.map(toThing)
      const runtime = buildCache(map, things)
      this.runtimeByPatient.set(map.patientId, runtime)

      for (const t of things) {
        if (t.deviceId) this.thingByDevice.set(t.deviceId, t)
      }
    }

    const allThings = [...this.runtimeByPatient.values()].flatMap(r => r.things)
    const thingById = new Map(allThings.map(t => [t.id, t]))
    const pinRecords = await db.select().from(usersPin)
    for (const pr of pinRecords) {
      if (pr.thingId) {
        const thing = thingById.get(pr.thingId)
        if (thing) this.thingByPin.set(pr.pin, thing)
      }
    }

    this.version++
  }

  async rebuildForPatient(patientId: string): Promise<void> {
    const oldRuntime = this.runtimeByPatient.get(patientId)
    if (oldRuntime) {
      for (const thing of oldRuntime.things) {
        if (thing.deviceId) this.thingByDevice.delete(thing.deviceId)
        for (const [pin, t] of this.thingByPin) {
          if (t.id === thing.id) this.thingByPin.delete(pin)
        }
      }
    }
    this.runtimeByPatient.delete(patientId)

    const rows = await db.select().from(homeMaps)
      .where(eq(homeMaps.patientId, patientId))
    const row = rows[0]
    if (!row) return

    const map = toHomeMap(row)
    const thingRows = await db.select().from(homeThings)
      .where(eq(homeThings.mapId, map.id))
    const things = thingRows.map(toThing)
    const runtime = buildCache(map, things)
    this.runtimeByPatient.set(patientId, runtime)
    for (const t of things) {
      if (t.deviceId) this.thingByDevice.set(t.deviceId, t)
    }

    const thingIds = new Set(runtime.things.map(t => t.id))
    const pinRecords = await db.select().from(usersPin)
    for (const pr of pinRecords) {
      if (pr.thingId && thingIds.has(pr.thingId)) {
        const thing = runtime.things.find(t => t.id === pr.thingId)
        if (thing) this.thingByPin.set(pr.pin, thing)
      }
    }
  }

  enrich(event: { deviceId?: string; pinCode?: string; tags: Record<string, unknown> }): void {
    const thing = event.deviceId
      ? this.thingByDevice.get(event.deviceId)
      : event.pinCode
        ? this.thingByPin.get(event.pinCode)
        : undefined
    if (!thing) return

    event.tags.thingId = thing.id
    event.tags.thingType = thing.thingType

    for (const runtime of this.runtimeByPatient.values()) {
      if (runtime.things.some(t => t.id === thing.id)) {
        const roomId = runtime.tileToRoomId.get(`${thing.tileX},${thing.tileY}`)
        if (roomId) {
          event.tags.roomId = roomId
          const room = runtime.rooms.find(r => r.id === roomId)
          if (room) event.tags.roomType = room.type
        }
        break
      }
    }
  }

  getRuntime(patientId: string): HomeMapRuntime | undefined {
    return this.runtimeByPatient.get(patientId)
  }

  getRuntimeByPin(pin: string): HomeMapRuntime | undefined {
    const thing = this.thingByPin.get(pin)
    if (!thing) return undefined
    for (const runtime of this.runtimeByPatient.values()) {
      if (runtime.things.some(t => t.id === thing.id)) {
        return runtime
      }
    }
    return undefined
  }
}

export const roomLookupCache = new RoomLookupCache()
