import { z } from 'zod'

const roomStateSchema = z.object({
  roomId: z.string(),
  roomName: z.string(),
  personPresent: z.boolean(),
  lastSeenAt: z.number().nullable(),
  lastLeftAt: z.number().nullable(),
  devicePins: z.array(z.string()),
  deviceCount: z.number(),
})

type RoomState = z.infer<typeof roomStateSchema>

interface TrajectoryStep {
  roomId: string
  roomName: string
  enteredAt: number
  leftAt?: number
}

class TwinStateCache {
  private rooms = new Map<string, RoomState>()
  private trajectory: TrajectoryStep[] = []
  private currentRoomId: string | null = null

  initRooms(roomDefs: { id: string; name: string }[]) {
    for (const r of roomDefs) {
      if (!this.rooms.has(r.id)) {
        this.rooms.set(r.id, {
          roomId: r.id,
          roomName: r.name,
          personPresent: false,
          lastSeenAt: null,
          lastLeftAt: null,
          devicePins: [],
          deviceCount: 0,
        })
      }
    }
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

  reportPresence(roomId: string, added: boolean, pin?: string): { changed: boolean; event?: string; fromRoom?: string; toRoom?: string; path?: string[] } {
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

  private _findPath(from: string, to: string): string[] {
    // Simple BFS on the room adjacency stored separately (set by external graph)
    if (from === to) return [from]
    const adjacency = this._adjacency ?? new Map<string, string[]>()
    const visited = new Set<string>()
    const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }]
    visited.add(from)

    while (queue.length > 0) {
      const { node, path } = queue.shift()!
      if (node === to) return path
      for (const neighbor of adjacency.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push({ node: neighbor, path: [...path, neighbor] })
        }
      }
    }
    return [from, to]
  }

  private _adjacency?: Map<string, string[]>
  setAdjacency(adj: Map<string, string[]>) { this._adjacency = adj }
}

export const twinState = new TwinStateCache()
export { roomStateSchema, type RoomState, type TrajectoryStep }