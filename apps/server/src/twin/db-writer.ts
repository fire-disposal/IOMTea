import type { DbClient } from '../core/db'
import { twinActorStates, twinMaps, twinRooms, twinEntities, twinBehaviorRules } from '../core/db'
import { eq } from 'drizzle-orm'
import type { ActorState } from './behavior'

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
