import { useMemo } from 'react'
import type { MapModel } from '@iomtea/shared-types/map'
import { createDefaultMap, buildGrid, createEmptyTiles } from '@iomtea/shared-types/map'
import { trpc } from '../trpc'

const MAP_ID = 'default'

export function useMapModel(patientIds: string[] = [], mapId?: string): MapModel {
  const id = mapId || MAP_ID
  const mapQuery = trpc.mapConfig.get.useQuery(
    { id },
    { staleTime: 30000 },
  )

  return useMemo(() => {
    const savedData = mapQuery.data
    if (savedData && (savedData as any).zones && Array.isArray((savedData as any).zones) && (savedData as any).zones.length > 0) {
      const raw = savedData as any
      const model: MapModel = {
        id: raw.id || id,
        width: raw.width || 15,
        height: raw.height || 13,
        tileSize: raw.tileSize || 1,
        tiles: createEmptyTiles(raw.width || 15, raw.height || 13),
        zones: raw.zones,
        entities: (raw.entities || []).map((e: any) => ({ ...e, patientId: e.patientId || undefined })),
      }
      buildGrid(model)
      return model
    }
    return createDefaultMap(patientIds)
  }, [mapQuery.data, patientIds])
}
