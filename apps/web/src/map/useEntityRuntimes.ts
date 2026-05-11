import { useRef, useMemo, useEffect } from 'react'
import type { MapModel, EntityRuntime, EntitySchedule } from '@iomtea/shared-types/map'
import { updateEntityBehavior } from '@iomtea/shared-types/map'

function defaultSchedule(): EntitySchedule {
  return {
    source: 'synthetic',
    entries: [
      { startHour: 0, endHour: 7, interactionType: 'sleep', requiresTag: 'can-lie' },
      { startHour: 7, endHour: 8, interactionType: 'eat', requiresTag: 'can-eat' },
      { startHour: 8, endHour: 12, interactionType: 'rest', requiresTag: 'can-sit' },
      { startHour: 12, endHour: 13, interactionType: 'eat', requiresTag: 'can-eat' },
      { startHour: 13, endHour: 18, interactionType: 'rest', requiresTag: 'can-sit' },
      { startHour: 18, endHour: 19, interactionType: 'eat', requiresTag: 'can-eat' },
      { startHour: 19, endHour: 24, interactionType: 'sleep', requiresTag: 'can-lie' },
    ],
  }
}

export function useEntityRuntimes(
  model: MapModel,
  simulatedTime: Date,
  deltaSec: number,
): Map<string, EntityRuntime> {
  const runtimesRef = useRef<Map<string, EntityRuntime>>(new Map())
  const initDone = useRef(false)

  useEffect(() => {
    if (!initDone.current) {
      const schedule = defaultSchedule()
      const personEntities = model.entities.filter((e) => e.defId === 'person')
      for (const ent of personEntities) {
        runtimesRef.current.set(ent.id, {
          entityId: ent.id,
          state: 'idle',
          currentTile: { x: ent.gridX, y: ent.gridY },
        })
      }
      initDone.current = true
    }
  }, [model])

  const schedule = useMemo(() => defaultSchedule(), [])

  return useMemo(() => {
    for (const [id, rt] of runtimesRef.current) {
      runtimesRef.current.set(id, updateEntityBehavior(rt, schedule, model, simulatedTime, deltaSec))
    }
    return runtimesRef.current
  }, [model, schedule, simulatedTime, deltaSec])
}
