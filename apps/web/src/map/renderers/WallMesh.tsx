/// <reference types="@react-three/fiber" />
import type { WallSegment } from '@iomtea/shared-types/map'

interface WallMeshProps {
  segment: WallSegment
}

const WALL_THICKNESS = 0.15
const WALL_HEIGHT = 3

export function WallMesh({ segment }: WallMeshProps) {
  const dx = segment.x2 - segment.x1
  const dz = segment.y2 - segment.y1
  const length = Math.sqrt(dx * dx + dz * dz)
  if (length < 0.001) return null

  const midX = (segment.x1 + segment.x2) / 2
  const midZ = (segment.y1 + segment.y2) / 2
  const angle = Math.atan2(dx, dz)

  return (
    <mesh position={[midX, WALL_HEIGHT / 2, midZ]} rotation-y={angle} castShadow receiveShadow>
      <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, length]} />
      <meshStandardMaterial color="#f5f0e8" />
    </mesh>
  )
}
