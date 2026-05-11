import { useMemo, useEffect, useState } from 'react'
import type { MapModel } from '@iomtea/shared-types/map'
import { createDefaultMap, buildGrid, createEmptyTiles } from '@iomtea/shared-types/map'
import { trpc } from '../trpc'

const MAP_ID = 'default'

export function useMapModel(patientIds: string[] = []): MapModel {
  const [savedData, setSavedData] = useState<Record<string, unknown> | null | undefined>(undefined)

  const mapQuery = trpc.mapConfig.get.useQuery(
    { id: MAP_ID },
    { staleTime: 30000 },
  )

  useEffect(() => {
    if (mapQuery.data !== undefined) {
      setSavedData(mapQuery.data)
    }
  }, [mapQuery.data])

  const model = useMemo(() => {
    if (savedData && (savedData as any).zones && Array.isArray((savedData as any).zones) && ((savedData as any).zones as any[]).length > 0) {
      const raw = savedData as any
      const model: MapModel = {
        id: raw.id || MAP_ID,
        width: raw.width || 15,
        height: raw.height || 13,
        tileSize: raw.tileSize || 1,
        tiles: createEmptyTiles(raw.width || 15, raw.height || 13),
        zones: raw.zones || [],
        entities: (raw.entities || []).map((e: any) => ({
          ...e,
          patientId: e.patientId || undefined,
        })),
      }
      buildGrid(model)
      return model
    }
    return createDefaultMap(patientIds)
  }, [savedData, patientIds])

  return model
}
