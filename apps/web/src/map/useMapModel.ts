import { useMemo } from 'react'
import { trpc } from '../trpc'

function getRoomColor(type: string): string {
  const colors: Record<string, string> = {
    bedroom: '#A8D8A8',
    livingroom: '#FFE4B5',
    kitchen: '#FFDAB9',
    bathroom: '#B0E0E6',
    study: '#E6E6FA',
    corridor: '#F0F0F0',
  }
  return colors[type] || '#FFFFFF'
}

export function useMapModel(mapId: string | undefined) {
  const mapQuery = trpc.twin.maps.get.useQuery(
    { id: mapId },
    { enabled: !!mapId },
  )

  const roomsQuery = trpc.twin.rooms.list.useQuery(
    { mapId: mapId! },
    { enabled: !!mapId },
  )

  const entitiesQuery = trpc.twin.entities.list.useQuery(
    { mapId: mapId! },
    { enabled: !!mapId },
  )

  return useMemo(() => {
    if (!mapQuery.data || !roomsQuery.data || !entitiesQuery.data) return null

    const grid = mapQuery.data.grid as number[][]
    const width = mapQuery.data.width
    const height = mapQuery.data.height

    return {
      id: mapQuery.data.id,
      name: mapQuery.data.name,
      width,
      height,
      grid,
      rooms: roomsQuery.data.map((r: { id: string; name: string; roomType: string; boundsX: number; boundsY: number; boundsW: number; boundsH: number; color?: string | null }) => ({
        id: r.id,
        name: r.name,
        roomType: r.roomType,
        x: r.boundsX, y: r.boundsY, w: r.boundsW, h: r.boundsH,
        color: r.color || getRoomColor(r.roomType),
      })),
      entities: entitiesQuery.data.map((e: { id: string; defId: string; category: string; gridX: number; gridY: number; orientation: string; layer: number; roomId: string | null; properties: unknown }) => ({
        id: e.id,
        defId: e.defId,
        category: e.category,
        gridX: e.gridX, gridY: e.gridY,
        orientation: e.orientation,
        layer: e.layer,
        roomId: e.roomId,
        properties: e.properties,
      })),
    }
  }, [mapQuery.data, roomsQuery.data, entitiesQuery.data])
}
