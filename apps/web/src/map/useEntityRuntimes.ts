import { useRef, useMemo } from 'react'
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
  const initializedRef = useRef(false)

  useMemo(() => {
    if (!initializedRef.current) {
      const personEntities = model.entities.filter((e) => e.defId === 'person')
      for (let i = 0; i < personEntities.length; i++) {
        const ent = personEntities[i]
        runtimesRef.current.set(ent.id, {
          entityId: ent.id,
          state: 'idle',
          currentTile: { x: ent.gridX, y: ent.gridY },
        })
      }
      initializedRef.current = true
    }
  }, [model])

  useMemo(() => {
    const schedule = defaultSchedule()
    for (const [id, rt] of runtimesRef.current) {
      const updated = updateEntityBehavior(rt, schedule, model, simulatedTime, deltaSec)
      runtimesRef.current.set(id, updated)
    }
  }, [model, simulatedTime, deltaSec])

  return runtimesRef.current
}
