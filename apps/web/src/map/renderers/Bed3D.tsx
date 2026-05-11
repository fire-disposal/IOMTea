import type { Entity, EntityDef } from '@iomtea/shared-types/map'

interface Bed3DProps {
  entity: Entity
  def: EntityDef
  tileSize: number
}

export function Bed3D({ entity, def, tileSize }: Bed3DProps) {
  const cx = (entity.gridX + def.size.w / 2) * tileSize
  const cz = (entity.gridY + def.size.h / 2) * tileSize

  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[2, 0.3, 1]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
      <mesh position={[0, 0.65, 0.45]} receiveShadow castShadow>
        <boxGeometry args={[2, 1, 0.1]} />
        <meshStandardMaterial color="#6B5335" />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[1.9, 0.05, 0.9]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
    </group>
  )
}
