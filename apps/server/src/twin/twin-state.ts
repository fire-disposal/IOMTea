import { z } from 'zod'

const roomStateSchema = z.object({
  roomId: z.string(),
  roomName: z.string(),
  personPresent: z.boolean(),
  lastSeenAt: z.number().nullable(),
  lastLeftAt: z.number().nullable(),
  devicePins: z.array(z.string()),
  deviceCount: z.number(),
  hasCamera: z.boolean(),
  inferrable: z.boolean(),
})

type RoomState = z.infer<typeof roomStateSchema>
type RoomDef = { id: string; name: string }
type RoomDefFull = RoomDef & { connections: string[]; hasCamera: boolean }

interface TrajectoryStep {
  roomId: string
  roomName: string
  enteredAt: number
  leftAt?: number
}
interface CoverageReport {
  inferrable: string[]
  blind: string[]
  covered: string[]
}

class TwinStateCache {
  private rooms = new Map<string, RoomState>()
  private trajectory: TrajectoryStep[] = []
  private currentRoomId: string | null = null
  private _adjacency = new Map<string, string[]>()

  initRooms(
    roomDefs: RoomDef[],
    roomDetails?: { id: string; connections: string[]; hasCamera: boolean }[],
  ) {
    const detailMap = new Map((roomDetails ?? []).map((d) => [d.id, d]))
    for (const r of roomDefs) {
      const detail = detailMap.get(r.id)
      this.rooms.set(r.id, {
        roomId: r.id,
        roomName: r.name,
        personPresent: false,
        lastSeenAt: null,
        lastLeftAt: null,
        devicePins: [],
        deviceCount: 0,
        hasCamera: detail?.hasCamera ?? false,
        inferrable: detail?.hasCamera ?? false,
      })
      if (detail) this._adjacency.set(r.id, detail.connections)
      else this._adjacency.set(r.id, [])
    }
    this._recalcInferrability()
  }

  private _recalcInferrability() {
    for (const room of this.rooms.values()) {
      if (room.hasCamera) {
        room.inferrable = true
        continue
      }
      const neighbors = this._adjacency.get(room.roomId) ?? []
      const hasCameraNeighbor = neighbors.some((nid) => this.rooms.get(nid)?.hasCamera)
      const allNeighborsCovered =
        neighbors.length > 0 && neighbors.every((nid) => this.rooms.get(nid)?.hasCamera)
      room.inferrable = allNeighborsCovered && neighbors.length >= 1
    }
  }

  getCoverageAnalysis(): CoverageReport {
    const inferrable: string[] = []
    const blind: string[] = []
    const covered: string[] = []
    for (const r of this.rooms.values()) {
      if (r.hasCamera) covered.push(r.roomId)
      else if (r.inferrable) inferrable.push(r.roomId)
      else blind.push(r.roomId)
    }
    return { inferrable, blind, covered }
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId)
  }
  getAllRooms(): RoomState[] {
    return Array.from(this.rooms.values())
  }
  getCurrentLocation(): string | null {
    return this.currentRoomId
  }
  getRecentTrajectory(limit = 10): TrajectoryStep[] {
    return this.trajectory.slice(-limit)
  }

  reportPresence(
    roomId: string,
    added: boolean,
    pin?: string,
  ): { changed: boolean; event?: string; fromRoom?: string; toRoom?: string; path?: string[] } {
    const room = this.rooms.get(roomId)
    const now = Date.now()
    const result: any = { changed: false }

    if (room) {
      if (pin && !room.devicePins.includes(pin)) {
        room.devicePins.push(pin)
        room.deviceCount = room.devicePins.length
      }

      if (added && !room.personPresent) {
        room.personPresent = true
        room.lastSeenAt = now
        result.changed = true
        result.event = 'enter'
        if (this.currentRoomId && this.currentRoomId !== roomId) {
          result.fromRoom = this.currentRoomId
          const prevStep = this.trajectory.find((s) => s.roomId === this.currentRoomId && !s.leftAt)
          if (prevStep) prevStep.leftAt = now
          result.path = this._findPath(this.currentRoomId, roomId)
        }
        this.currentRoomId = roomId
        this.trajectory.push({ roomId, roomName: room.roomName, enteredAt: now })
        this._clearOtherRooms(roomId)
      } else if (!added && room.personPresent) {
        room.personPresent = false
        room.lastLeftAt = now
        result.changed = true
        result.event = 'exit'
        result.fromRoom = roomId
      }
    }
    return result
  }

  private _clearOtherRooms(excludeRoomId: string) {
    for (const [id, room] of this.rooms) {
      if (id !== excludeRoomId) {
        room.personPresent = false
        room.lastLeftAt = Date.now()
      }
    }
  }

  private _findPath(from: string, to: string): string[] {
    if (from === to) return [from]
    const visited = new Set<string>()
    visited.add(from)
    const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }]
    while (queue.length > 0) {
      const { node, path } = queue.shift()!
      if (node === to) return path
      for (const neighbor of this._adjacency.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push({ node: neighbor, path: [...path, neighbor] })
        }
      }
    }
    return [from, to]
  }

  setAdjacency(adj: Map<string, string[]>) {
    this._adjacency = adj
    this._recalcInferrability()
  }
}

export const twinState = new TwinStateCache()
export {
  roomStateSchema,
  type RoomState,
  type TrajectoryStep,
  type CoverageReport,
  type RoomDef,
  type RoomDefFull,
}
