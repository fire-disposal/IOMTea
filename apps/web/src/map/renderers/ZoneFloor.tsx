import { useMemo } from 'react'
import type { Zone } from '@iomtea/shared-types/map'
import { getZoneDef } from '@iomtea/shared-types/map'

interface ZoneFloorProps {
  zone: Zone
  tileSize: number
}

export function ZoneFloor({ zone, tileSize }: ZoneFloorProps) {
  const zoneDef = getZoneDef(zone.defId)
  const width = (zone.bounds.x2 - zone.bounds.x1 + 1) * tileSize
  const depth = (zone.bounds.y2 - zone.bounds.y1 + 1) * tileSize
  const cx = (zone.bounds.x1 + zone.bounds.x2 + 1) * tileSize / 2
  const cz = (zone.bounds.y1 + zone.bounds.y2 + 1) * tileSize / 2

  const color = useMemo(() => zoneDef?.color || '#eeeeee', [zoneDef])

  return (
    <mesh position={[cx, 0.01, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}
