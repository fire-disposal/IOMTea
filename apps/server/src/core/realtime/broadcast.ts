import type { WebSocket } from 'ws'

interface SimEventPayload {
  patientId: string
  deviceId: string
  kind: 'observation' | 'alert'
  metric: string
  value: number | null
  unit: string | null
  severity?: string | null
  status?: string | null
  tags: Record<string, unknown>
  recordedAt: string
}

interface EntityStatePayload {
  entityId: string
  state: string
  tileX: number
  tileY: number
  posture: string
}

interface TwinActorPayload {
  entityId: string
  tileX: number
  tileY: number
  posture: string
  behaviorState: string
  currentRoomId: string | null
  pathProgress: number
}

interface SimServerMessage {
  type: 'tick'
  wardId: string
  simulatedTime: string
  timezone: string
  hourOfDay: number
  events: SimEventPayload[]
  entityStates: EntityStatePayload[]
}

interface TwinServerMessage {
  type: 'twin_tick'
  mapId: string
  simTime: string
  actors: TwinActorPayload[]
}

type ServerMessage = SimServerMessage | TwinServerMessage

class BroadcastManager {
  private subscribers = new Map<string, Set<WebSocket>>()
  private mapSubscribers = new Map<string, Set<WebSocket>>()

  subscribe(wardId: string, ws: WebSocket): void {
    if (!this.subscribers.has(wardId)) {
      this.subscribers.set(wardId, new Set())
    }
    const wardSubs = this.subscribers.get(wardId)
    if (wardSubs) {
      wardSubs.add(ws)
    }
  }

  unsubscribe(wardId: string, ws: WebSocket): void {
    this.subscribers.get(wardId)?.delete(ws)
    if (this.subscribers.get(wardId)?.size === 0) {
      this.subscribers.delete(wardId)
    }
  }

  unsubscribeAll(ws: WebSocket): void {
    for (const [wardId, sockets] of this.subscribers) {
      sockets.delete(ws)
      if (sockets.size === 0) this.subscribers.delete(wardId)
    }
    for (const [mapId, sockets] of this.mapSubscribers) {
      sockets.delete(ws)
      if (sockets.size === 0) this.mapSubscribers.delete(mapId)
    }
  }

  broadcast(
    wardId: string,
    simulatedTime: string,
    timezone: string,
    hourOfDay: number,
    events: SimEventPayload[],
    entityStates: EntityStatePayload[],
  ): void {
    const sockets = this.subscribers.get(wardId)
    if (!sockets || sockets.size === 0) return

    const message: SimServerMessage = { type: 'tick', wardId, simulatedTime, timezone, hourOfDay, events, entityStates }
    const data = JSON.stringify(message)

    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data)
      }
    }
  }

  subscribeMap(mapId: string, ws: WebSocket): void {
    if (!this.mapSubscribers.has(mapId)) {
      this.mapSubscribers.set(mapId, new Set())
    }
    const mapSubs = this.mapSubscribers.get(mapId)
    if (mapSubs) {
      mapSubs.add(ws)
    }
  }

  broadcastTwin(mapId: string, simTime: string, actors: TwinActorPayload[]): void {
    const sockets = this.mapSubscribers.get(mapId)
    if (!sockets || sockets.size === 0) return

    const message: TwinServerMessage = { type: 'twin_tick', mapId, simTime, actors }
    const data = JSON.stringify(message)

    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data)
      }
    }
  }
}

export const broadcastManager = new BroadcastManager()
