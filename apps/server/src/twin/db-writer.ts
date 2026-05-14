import type { DbClient } from '../core/db'
import { twinActivityLog, twinActorStates, twinMaps, twinRooms, twinEntities, twinBehaviorRules } from '../core/db'
import { eq } from 'drizzle-orm'
import type { ActorState } from './behavior'

export async function saveActivityLog(
  db: DbClient,
  actorEntityId: string,
  action: string,
  fromRoomId: string | null,
  toRoomId: string | null,
  durationMs?: number,
  metadata?: Record<string, any>,
): Promise<void> {
  await db.insert(twinActivityLog).values({
    actorEntityId,
    action,
    fromRoomId,
    toRoomId,
    durationMs: durationMs ?? null,
    metadata: metadata ?? {},
  })
}

export async function saveActorState(db: DbClient, actor: ActorState): Promise<void> {
  const existing = await db
    .select()
    .from(twinActorStates)
    .where(eq(twinActorStates.entityId, actor.entityId))
    .limit(1)

  if (existing.length > 0) {
    await db.update(twinActorStates)
      .set({
        currentRoomId: actor.currentRoomId,
        tileX: actor.tileX,
        tileY: actor.tileY,
        posture: actor.posture as any,
        behaviorState: actor.behaviorState as any,
        activeInstruction: actor.activeInstruction as any,
        instructionQueue: actor.instructionQueue as any,
        targetTileX: actor.targetTileX,
        targetTileY: actor.targetTileY,
        path: actor.path as any,
        pathProgress: actor.pathProgress,
      })
      .where(eq(twinActorStates.entityId, actor.entityId))
  } else {
    await db.insert(twinActorStates).values({
      entityId: actor.entityId,
      currentRoomId: actor.currentRoomId,
      tileX: actor.tileX,
      tileY: actor.tileY,
      posture: actor.posture as any,
      behaviorState: actor.behaviorState as any,
      activeInstruction: actor.activeInstruction as any,
      instructionQueue: actor.instructionQueue as any,
      targetTileX: actor.targetTileX,
      targetTileY: actor.targetTileY,
      path: actor.path as any,
      pathProgress: actor.pathProgress,
    })
  }
}

export async function loadMapData(db: DbClient, mapId: string) {
  const map = await db.select().from(twinMaps).where(eq(twinMaps.id, mapId)).limit(1)
  if (map.length === 0) throw new Error(`Map ${mapId} not found`)

  const rooms = await db.select().from(twinRooms).where(eq(twinRooms.mapId, mapId))
  const entities = await db.select().from(twinEntities).where(eq(twinEntities.mapId, mapId))
  const actors = entities.filter((e) => e.category === 'actor')
  const behaviorRules = await db.select().from(twinBehaviorRules).where(
    eq(twinBehaviorRules.patientId, map[0].patientId),
  )

  return { map: map[0], rooms, entities, actors, behaviorRules }
}

export async function getActorStatesFromDb(db: DbClient, mapId: string) {
  const entities = await db.select().from(twinEntities).where(eq(twinEntities.mapId, mapId))
  const actorEntityIds = entities.filter((e) => e.category === 'actor').map((e) => e.id)
  if (actorEntityIds.length === 0) return []

  const states: any[] = []
  for (const entityId of actorEntityIds) {
    const rows = await db.select().from(twinActorStates).where(eq(twinActorStates.entityId, entityId)).limit(1)
    if (rows.length > 0) states.push(rows[0])
  }
  return states
}
