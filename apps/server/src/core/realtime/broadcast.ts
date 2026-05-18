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

interface PersonLocationMessage {
  type: 'person_location'
  patientId: string
  roomId: string | null
  fromRoomId?: string
  path?: string[]
  event: string
  timestamp: number
}

interface VitalsUpdateMessage {
  type: 'vitals_update'
  patientId: string
  metrics: { metric: string; value: number | null; unit: string | null }[]
  timestamp: number
}

class BroadcastManager {
  private subscribers = new Map<string, Set<WebSocket>>()
  private mapSubscribers = new Map<string, Set<WebSocket>>()
  private patientSubscribers = new Map<string, Set<WebSocket>>()

  subscribe(wardId: string, ws: WebSocket): void {
    if (!this.subscribers.has(wardId)) this.subscribers.set(wardId, new Set())
    this.subscribers.get(wardId)?.add(ws)
  }

  unsubscribe(wardId: string, ws: WebSocket): void {
    this.subscribers.get(wardId)?.delete(ws)
    if (this.subscribers.get(wardId)?.size === 0) this.subscribers.delete(wardId)
  }

  subscribePatient(patientId: string, ws: WebSocket): void {
    if (!this.patientSubscribers.has(patientId)) this.patientSubscribers.set(patientId, new Set())
    this.patientSubscribers.get(patientId)?.add(ws)
  }

  unsubscribePatient(patientId: string, ws: WebSocket): void {
    this.patientSubscribers.get(patientId)?.delete(ws)
    if (this.patientSubscribers.get(patientId)?.size === 0) this.patientSubscribers.delete(patientId)
  }

  unsubscribeAll(ws: WebSocket): void {
    for (const [key, sockets] of this.subscribers) { sockets.delete(ws); if (sockets.size === 0) this.subscribers.delete(key) }
    for (const [key, sockets] of this.mapSubscribers) { sockets.delete(ws); if (sockets.size === 0) this.mapSubscribers.delete(key) }
    for (const [key, sockets] of this.patientSubscribers) { sockets.delete(ws); if (sockets.size === 0) this.patientSubscribers.delete(key) }
  }

  broadcastPersonLocation(patientId: string, data: Omit<PersonLocationMessage, 'type' | 'patientId'>): void {
    const message: PersonLocationMessage = { type: 'person_location', patientId, ...data }
    this._sendToPatient(patientId, message)
  }

  broadcastVitals(patientId: string, metrics: VitalsUpdateMessage['metrics']): void {
    const message: VitalsUpdateMessage = { type: 'vitals_update', patientId, metrics, timestamp: Date.now() }
    this._sendToPatient(patientId, message)
  }

  private _sendToPatient(patientId: string, message: PersonLocationMessage | VitalsUpdateMessage): void {
    const sockets = this.patientSubscribers.get(patientId)
    if (!sockets || sockets.size === 0) return
    const data = JSON.stringify(message)
    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) ws.send(data)
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
