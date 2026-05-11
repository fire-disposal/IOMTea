import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import type { Entity, EntityDef } from '@iomtea/shared-types/map'

interface DeviceMarker3DProps {
  entity: Entity
  def: EntityDef
  tileSize: number
}

const statusColors: Record<string, string> = {
  normal: '#00cc66',
  warning: '#ff9900',
  alert: '#ff3333',
}

export function DeviceMarker3D({ entity, def, tileSize }: DeviceMarker3DProps) {
  const ringRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef(0)
  const cx = (entity.gridX + def.pivot.x) * tileSize
  const cz = (entity.gridY + def.pivot.y) * tileSize
  const layerY = entity.layer === 2 ? 2.5 : entity.layer === 1 ? 0.5 : 0.3
  const color = statusColors[entity.status || 'normal'] || statusColors.normal

  useFrame((_, delta) => {
    if (entity.status === 'alert' && ringRef.current) {
      pulseRef.current += delta * 3
      const scale = 1 + Math.sin(pulseRef.current) * 0.3
      ringRef.current.scale.setScalar(scale)
      const mat = ringRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + Math.sin(pulseRef.current * 2) * 0.5
    }
  })

  return (
    <group position={[cx, layerY, cz]}>
      <mesh castShadow>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.03, 8, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} />
      </mesh>
      <Html position={[0, 0.3, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          color: '#fff',
          fontSize: 9,
          background: 'rgba(0,0,0,0.6)',
          padding: '1px 4px',
          borderRadius: 2,
          whiteSpace: 'nowrap',
        }}>
          {def.label}
        </div>
      </Html>
    </group>
  )
}
