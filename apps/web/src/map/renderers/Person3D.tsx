/// <reference types="@react-three/fiber" />
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { Entity, EntityDef } from '@iomtea/shared-types/map'
import type { EntityState } from '../../store/entityState'

interface Person3DProps {
  entity: Entity
  def: EntityDef
  tileSize: number
  entityState?: EntityState
  patientData?: { heartRate: number | null; spO2: number | null; systolicBP: number | null; diastolicBP: number | null }
}

export function Person3D({ entity, def, tileSize, entityState, patientData }: Person3DProps) {
  const groupRef = useRef<THREE.Group>(null)
  const currentPos = useRef({ x: entity.gridX, y: entity.gridY })
  const posture = entityState?.posture || (entity.meta?.posture as string) || 'standing'

  const targetX = entityState?.tileX ?? entity.gridX
  const targetY = entityState?.tileY ?? entity.gridY

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const lerp = Math.min(1, delta * 8)
    currentPos.current.x += (targetX - currentPos.current.x) * lerp
    currentPos.current.y += (targetY - currentPos.current.y) * lerp
    groupRef.current.position.x = (currentPos.current.x + def.pivot.x) * tileSize
    groupRef.current.position.z = (currentPos.current.y + def.pivot.y) * tileSize
  })

  const layerY = entity.layer === 1 ? 0.5 : 0
  const bodyRotation: [number, number, number] = posture === 'lying' ? [0, 0, Math.PI / 2] : [0, 0, 0]
  const bodyOffset: [number, number, number] = posture === 'lying' ? [0, 0.3, 0] : [0, 1.1, 0]
  const headY = posture === 'lying' ? 1.1 : 2.1
  const htmlY = posture === 'lying' ? 1.5 : 2.5

  return (
    <group ref={groupRef} rotation={bodyRotation}>
      <mesh position={bodyOffset} castShadow><capsuleGeometry args={[0.2, 1.2, 4, 8]} /><meshStandardMaterial color="#f5c6a0" /></mesh>
      <mesh position={[0, headY, 0]} castShadow><sphereGeometry args={[0.18, 16, 16]} /><meshStandardMaterial color="#f5c6a0" /></mesh>
      {patientData && (
        <Html position={[0, htmlY, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 11, whiteSpace: 'nowrap' }}>
            <div>HR: {patientData.heartRate ?? '--'} bpm</div>
            <div>SpO2: {patientData.spO2 ?? '--'}%</div>
            {patientData.systolicBP && <div>BP: {patientData.systolicBP}/{patientData.diastolicBP}</div>}
          </div>
        </Html>
      )}
    </group>
  )
}
