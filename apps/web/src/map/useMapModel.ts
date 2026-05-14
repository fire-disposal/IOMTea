import { useMemo } from 'react'
import type { MapModel } from '@iomtea/shared-types/map'
import { createDefaultMap } from '@iomtea/shared-types/map'

export function useMapModel(patientIds: string[] = [], _mapId?: string): MapModel {
  return useMemo(() => createDefaultMap(patientIds), [patientIds])
}
