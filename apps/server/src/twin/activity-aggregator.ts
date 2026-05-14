import type { DbClient } from '../core/db'
import { twinActivityLog, patientSnapshots, twinEntities } from '../core/db'
import { eq, and, gte, lt } from 'drizzle-orm'

interface ActivitySummary {
  patientId: string
  totalMovements: number
  roomTransitions: Record<string, number>
  timeInRooms: Record<string, number>
  activityByHour: number[]
  postureChanges: Record<string, number>
  behaviorEvents: Record<string, number>
}

export type SnapshotType = 'daily' | 'weekly' | 'monthly'

export async function aggregateDailyActivity(
  db: DbClient,
  entityId: string,
  patientId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<ActivitySummary> {
  const logs = await db
    .select()
    .from(twinActivityLog)
    .where(
      and(
        eq(twinActivityLog.actorEntityId, entityId),
        gte(twinActivityLog.recordedAt, periodStart),
        lt(twinActivityLog.recordedAt, periodEnd),
      ),
    )

  const summary: ActivitySummary = {
    patientId,
    totalMovements: 0,
    roomTransitions: {},
    timeInRooms: {},
    activityByHour: Array(24).fill(0),
    postureChanges: {},
    behaviorEvents: {},
  }

  for (const log of logs) {
    const hour = new Date(log.recordedAt).getHours()
    summary.activityByHour[hour]++

    if (log.action.includes('moved') || log.action.includes('entered_room')) {
      summary.totalMovements++
    }

    if (log.toRoomId) {
      summary.roomTransitions[log.toRoomId] = (summary.roomTransitions[log.toRoomId] || 0) + 1
    }

    if (log.durationMs && log.fromRoomId) {
      summary.timeInRooms[log.fromRoomId] = (summary.timeInRooms[log.fromRoomId] || 0) + log.durationMs
    }

    const action = log.action
    summary.behaviorEvents[action] = (summary.behaviorEvents[action] || 0) + 1
  }

  return summary
}

export async function createSnapshot(
  db: DbClient,
  patientId: string,
  snapshotType: SnapshotType,
  periodStart: Date,
  periodEnd: Date,
  summary: ActivitySummary,
): Promise<void> {
  const existing = await db
    .select()
    .from(patientSnapshots)
    .where(
      and(
        eq(patientSnapshots.patientId, patientId),
        eq(patientSnapshots.snapshotType, snapshotType as any),
        eq(patientSnapshots.periodStart, periodStart),
        eq(patientSnapshots.periodEnd, periodEnd),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(patientSnapshots)
      .set({ data: summary as any })
      .where(eq(patientSnapshots.id, existing[0].id))
  } else {
    await db.insert(patientSnapshots).values({
      patientId,
      snapshotType: snapshotType as any,
      data: summary as any,
      periodStart,
      periodEnd,
    })
  }
}

export async function aggregateAllPatientsDaily(
  db: DbClient,
  date: Date,
): Promise<{ patientId: string; success: boolean }[]> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const actors = await db
    .select()
    .from(twinEntities)
    .where(eq(twinEntities.category, 'actor' as any))

  const results: { patientId: string; success: boolean }[] = []

  for (const actor of actors) {
    if (!actor.patientId) continue
    try {
      const summary = await aggregateDailyActivity(
        db,
        actor.id,
        actor.patientId,
        startOfDay,
        endOfDay,
      )
      await createSnapshot(db, actor.patientId, 'daily', startOfDay, endOfDay, summary)
      results.push({ patientId: actor.patientId, success: true })
    } catch (err) {
      results.push({ patientId: actor.patientId!, success: false })
    }
  }

  return results
}
