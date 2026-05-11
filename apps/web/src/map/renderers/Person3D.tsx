import { Html } from '@react-three/drei'
import type { Entity, EntityDef, EntityRuntime } from '@iomtea/shared-types/map'

interface Person3DProps {
  entity: Entity
  def: EntityDef
  tileSize: number
  runtime?: EntityRuntime
  patientData?: {
    heartRate: number | null
    spO2: number | null
    systolicBP: number | null
    diastolicBP: number | null
  }
}

function tileToWorld(x: number, y: number, tileSize: number): [number, number] {
  return [(x + 0.5) * tileSize, (y + 0.5) * tileSize]
}

function interpolatePosition(
  path: { x: number; y: number }[] | undefined,
  progress: number | undefined,
  tileSize: number,
): [number, number] {
  if (!path || path.length === 0) return [0, 0]
  if (progress === undefined || progress >= 1) {
    return tileToWorld(path[path.length - 1].x, path[path.length - 1].y, tileSize)
  }
  const idx = Math.floor(progress * (path.length - 1))
  const nextIdx = Math.min(idx + 1, path.length - 1)
  const localProgress = (progress * (path.length - 1)) - idx
  const from = tileToWorld(path[idx].x, path[idx].y, tileSize)
  const to = tileToWorld(path[nextIdx].x, path[nextIdx].y, tileSize)
  return [
    from[0] + (to[0] - from[0]) * localProgress,
    from[1] + (to[1] - from[1]) * localProgress,
  ]
}

export function Person3D({ entity, def, tileSize, runtime, patientData }: Person3DProps) {
  const posture = (entity.meta?.posture as string) || 'standing'
  const [worldX, worldZ] = runtime?.state === 'moving'
    ? interpolatePosition(runtime.path, runtime.pathProgress, tileSize)
    : tileToWorld(entity.gridX, entity.gridY, tileSize)

  const layerY = entity.layer === 1 ? 0.5 : 0

  const bodyRotation: [number, number, number] =
    posture === 'lying' ? [0, 0, Math.PI / 2] : [0, 0, 0]

  const bodyOffset: [number, number, number] = posture === 'lying' ? [0, 0.3, 0] : [0, 1.1, 0]
  const headY = posture === 'lying' ? 1.1 : 2.1
  const htmlY = posture === 'lying' ? 1.5 : 2.5

  return (
    <group position={[worldX, layerY, worldZ]} rotation={bodyRotation}>
      <mesh position={bodyOffset} castShadow>
        <capsuleGeometry args={[0.2, 1.2, 4, 8]} />
        <meshStandardMaterial color="#f5c6a0" />
      </mesh>
      <mesh position={[0, headY, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#f5c6a0" />
      </mesh>
      {patientData && (
        <Html position={[0, htmlY, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 11,
            whiteSpace: 'nowrap',
          }}>
            <div>HR: {patientData.heartRate ?? '--'} bpm</div>
            <div>SpO2: {patientData.spO2 ?? '--'}%</div>
            {patientData.systolicBP && <div>BP: {patientData.systolicBP}/{patientData.diastolicBP}</div>}
          </div>
        </Html>
      )}
    </group>
  )
}
