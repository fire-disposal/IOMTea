import type { MapModel, EntityRuntime, EntitySchedule } from './types'
import { getEntityDef, getInteractionDef } from './registries'
import { entitiesAt } from './grid'
import { findPath } from './pathfinding'

function resolveActivity(
  schedule: EntitySchedule,
  hour: number,
): { interactionType: string; requiresTag: string } | null {
  for (const entry of schedule.entries) {
    if (entry.startHour <= hour && entry.endHour > hour) {
      return { interactionType: entry.interactionType, requiresTag: entry.requiresTag }
    }
  }
  const wrapEntry = schedule.entries.find((e) => e.endHour < e.startHour)
  if (wrapEntry && (hour >= wrapEntry.startHour || hour < wrapEntry.endHour)) {
    return { interactionType: wrapEntry.interactionType, requiresTag: wrapEntry.requiresTag }
  }
  return null
}

function findNearestEntityWithTag(
  model: MapModel,
  from: { x: number; y: number },
  tag: string,
): { entity: { id: string }; tile: { x: number; y: number } } | null {
  let best: { entity: { id: string }; tile: { x: number; y: number }; dist: number } | null = null
  for (const ent of model.entities) {
    const def = getEntityDef(ent.defId)
    if (!def?.tags?.includes(tag)) continue
    const cx = ent.gridX + Math.floor(def.size.w / 2)
    const cy = ent.gridY + Math.floor(def.size.h / 2)
    const dist = Math.abs(from.x - cx) + Math.abs(from.y - cy)
    if (!best || dist < best.dist) {
      best = { entity: { id: ent.id }, tile: { x: cx, y: cy }, dist }
    }
  }
  return best ? { entity: best.entity, tile: best.tile } : null
}

export function updateEntityBehavior(
  runtime: EntityRuntime,
  schedule: EntitySchedule,
  model: MapModel,
  simulatedTime: Date,
  deltaSec: number,
): EntityRuntime {
  if (!simulatedTime || isNaN(simulatedTime.getTime())) return runtime

  switch (runtime.state) {
    case 'idle': {
      const hour = simulatedTime.getHours() + simulatedTime.getMinutes() / 60
      const activity = resolveActivity(schedule, hour)
      if (!activity) return runtime

      const target = findNearestEntityWithTag(model, runtime.currentTile, activity.requiresTag)
      if (!target) return runtime

      const path = findPath(model, runtime.currentTile, target.tile)
      if (!path) return runtime

      const def = getInteractionDef(activity.interactionType)
      return {
        ...runtime,
        state: 'moving',
        path: path.path,
        pathProgress: 0,
        interaction: {
          type: activity.interactionType,
          targetEntityId: target.entity.id,
          targetTile: target.tile,
          durationMinutes: def?.defaultDuration ?? 30,
          posture: def?.posture ?? 'standing',
          startedAt: 0,
        },
      }
    }

    case 'moving': {
      if (!runtime.path) return { ...runtime, state: 'idle' }
      const speed = 3.0
      const progress = (runtime.pathProgress ?? 0) + (deltaSec * speed) / runtime.path.length
      if (progress >= 1.0) {
        const tile = runtime.path[runtime.path.length - 1]
        const interaction = runtime.interaction
          ? { ...runtime.interaction, startedAt: simulatedTime.getTime() }
          : undefined
        return {
          ...runtime,
          state: 'acting',
          currentTile: tile,
          interaction,
          path: undefined,
          pathProgress: undefined,
        }
      }
      return { ...runtime, pathProgress: progress }
    }

    case 'acting': {
      if (!runtime.interaction) return { ...runtime, state: 'idle' }
      const elapsedMs = simulatedTime.getTime() - runtime.interaction.startedAt
      const elapsedMin = elapsedMs / 60000
      if (elapsedMin >= runtime.interaction.durationMinutes) {
        return { ...runtime, state: 'idle', interaction: undefined }
      }
      return runtime
    }

    default:
      return runtime
  }
}
