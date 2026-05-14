import type { DbClient } from '../../core/db'
import { twinCvDetections, events, twinRooms, twinEntities } from '../../core/db'
import { eq } from 'drizzle-orm'
import type { PatientEngine } from '../../twin/engine'
import { enqueueInstruction } from '../../twin/instruction'

interface CvDetection {
  cameraId: string
  patientId: string
  detectedClass: string
  confidence: number
  bbox: { x: number; y: number; w: number; h: number }
  timestamp: number
  snapshotUrl?: string
}

const cameraRoomMap = new Map<string, { mapId: string; roomName: string }>()

export function registerCamera(cameraId: string, mapId: string, roomName: string): void {
  cameraRoomMap.set(cameraId, { mapId, roomName })
}

async function resolveRoom(db: DbClient, cameraId: string): Promise<{ mapId: string; roomId: string | null; roomName: string } | null> {
  const registered = cameraRoomMap.get(cameraId)
  if (registered) {
    const rooms = await db.select().from(twinRooms).where(eq(twinRooms.name, registered.roomName)).limit(1)
    return {
      mapId: registered.mapId,
      roomId: rooms.length > 0 ? rooms[0].id : null,
      roomName: registered.roomName,
    }
  }
  return null
}

export async function handleCvDetection(
  db: DbClient,
  engineRegistry: Map<string, PatientEngine>,
  detection: CvDetection,
): Promise<{ eventId: string; synced: boolean; roomResolved: boolean }> {
  const roomInfo = await resolveRoom(db, detection.cameraId)

  const [detectionRecord] = await db.insert(twinCvDetections).values({
    patientId: detection.patientId,
    mapId: roomInfo?.mapId ?? '00000000-0000-0000-0000-000000000000',
    cameraId: detection.cameraId,
    detectedAt: new Date(detection.timestamp),
    detectedClass: detection.detectedClass,
    confidence: detection.confidence,
    bbox: detection.bbox,
    inferredRoomId: roomInfo?.roomId ?? null,
    synced: false,
  }).returning()

  const [eventRecord] = await db.insert(events).values({
    patientId: detection.patientId,
    kind: 'location' as any,
    metric: 'cv_detection',
    confidence: detection.confidence,
    source: 'cv' as any,
    value: null,
    tags: {
      cameraId: detection.cameraId,
      detectedClass: detection.detectedClass,
      bbox: detection.bbox,
      roomId: roomInfo?.roomId,
      roomName: roomInfo?.roomName,
    },
    recordedAt: new Date(detection.timestamp),
  }).returning()

  let synced = false
  if (roomInfo?.roomId && detection.confidence > 0.7) {
    const engine = engineRegistry.get(roomInfo.mapId)
    if (engine) {
      for (const actor of engine.actors.values()) {
        const entity = await db.select().from(twinEntities).where(eq(twinEntities.id, actor.entityId)).limit(1)
        if (entity.length > 0 && entity[0].patientId === detection.patientId) {
          enqueueInstruction(actor, {
            id: crypto.randomUUID(),
            type: 'move_to_room',
            actorEntityId: actor.entityId,
            params: { type: 'move_to_room', room: roomInfo.roomId },
            priority: 0,
            preemptible: false,
          })
          synced = true
          break
        }
      }
    }
  }

  if (synced) {
    await db.update(twinCvDetections).set({ synced: true, syncedAt: new Date() }).where(eq(twinCvDetections.id, detectionRecord.id))
  }

  return { eventId: eventRecord.id, synced, roomResolved: !!roomInfo }
}

export interface CvDetectionRequest {
  cameraId: string
  patientId: string
  detectedClass: string
  confidence: number
  bbox: { x: number; y: number; w: number; h: number }
  timestamp?: number
  snapshot?: string
}

export async function processCvRequest(
  db: DbClient,
  engineRegistry: Map<string, PatientEngine>,
  body: CvDetectionRequest,
): Promise<{ success: boolean; eventId: string; synced: boolean }> {
  const { eventId, synced } = await handleCvDetection(db, engineRegistry, {
    cameraId: body.cameraId,
    patientId: body.patientId,
    detectedClass: body.detectedClass,
    confidence: body.confidence,
    bbox: body.bbox,
    timestamp: body.timestamp ?? Date.now(),
    snapshotUrl: body.snapshot,
  })
  return { success: true, eventId, synced }
}
