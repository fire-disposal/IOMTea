import { useMemo } from 'react'
import { buildCache, type HomeMapRuntime, type HomeMap, type Thing } from '@iomtea/shared-types'
import { trpc } from '../trpc'

function castRowToMap(row: any): HomeMap {
  return {
    id: row.id,
    patientId: row.patientId,
    templateId: row.templateId ?? null,
    packedGrid: row.packedGrid,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  }
}

function castRowToThing(row: any): Thing {
  return {
    id: row.id,
    thingType: row.thingType,
    tileX: row.tileX,
    tileY: row.tileY,
    tileW: row.tileW ?? 1,
    tileH: row.tileH ?? 1,
    rotation: (row.rotation ?? 0) as 0 | 1 | 2 | 3,
    deviceId: row.deviceId ?? null,
    tags: row.tags ?? {},
    config: row.config ?? {},
  }
}

export function useHomeMap(patientId: string | undefined) {
  const { data, isLoading, error, refetch } = trpc.homeMap.getByPatient.useQuery(
    { patientId: patientId! },
    { enabled: !!patientId }
  )

  const runtime = useMemo<HomeMapRuntime | null>(() => {
    if (!data?.map) return null
    const map: HomeMap = castRowToMap(data.map)
    const things: Thing[] = (data.things ?? []).map(castRowToThing)
    return buildCache(map, things)
  }, [data])

  return { runtime, isLoading, error, refetch }
}
