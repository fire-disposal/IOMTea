import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { useEntityStateStore } from '../store/entityState'

interface TwinRoomData {
  id: string; name: string; x: number; y: number; w: number; h: number; color: string
}

interface TwinEntityData {
  id: string; defId: string; category: string
  gridX: number; gridY: number; orientation: string
  layer: number; roomId: string | null
}

interface TwinMapData {
  id: string; name: string; width: number; height: number
  grid: number[][]
  rooms: TwinRoomData[]
  entities: TwinEntityData[]
}

function WallGenerator({ grid, tileSize }: { grid: number[][]; tileSize: number }) {
  const walls = useMemo(() => {
    const result: { key: string; position: [number, number, number]; size: [number, number, number] }[] = []
    const h = grid.length
    const w = grid[0]?.length ?? 0

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] === 0) continue
        if (x + 1 < w && grid[y][x + 1] === 0) {
          result.push({
            key: `w-r-${x}-${y}`,
            position: [x + 0.5, 1.5, y + 0.5],
            size: [0.1, 3, 1],
          })
        }
        if (y + 1 < h && (grid[y + 1]?.[x] ?? 0) === 0) {
          result.push({
            key: `w-b-${x}-${y}`,
            position: [x + 0.5, 1.5, y + 1],
            size: [1, 3, 0.1],
          })
        }
      }
    }
    return result
  }, [grid])

  return (
    <>
      {walls.map((w) => (
        <mesh key={w.key} position={w.position} castShadow receiveShadow>
          <boxGeometry args={w.size} />
          <meshStandardMaterial color="#f5f0e8" />
        </mesh>
      ))}
    </>
  )
}

function EntityMesh({ defId, category, position, orientation }: {
  defId: string; category: string; position: [number, number, number]; orientation: string
}) {
  const [x, y, z] = position

  if (category === 'actor') {
    return (
      <group position={[x, y, z]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <capsuleGeometry args={[0.15, 0.8, 4, 8]} />
          <meshStandardMaterial color="#f5c6a0" />
        </mesh>
        <mesh position={[0, 1.55, 0]} castShadow>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#f5c6a0" />
        </mesh>
        <Html center position={[0, 2.0, 0]} distanceFactor={10}>
          <div style={{
            background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px',
            borderRadius: 4, fontSize: 10, whiteSpace: 'nowrap',
          }}>
            ❤️ - 🫁 -%
          </div>
        </Html>
      </group>
    )
  }

  if (defId === 'bed') {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.5, 1.8]} />
          <meshStandardMaterial color="#fafafa" />
        </mesh>
        <mesh position={[0, 0.7, -0.8]} castShadow>
          <boxGeometry args={[0.9, 0.4, 0.1]} />
          <meshStandardMaterial color="#6B5335" />
        </mesh>
      </group>
    )
  }

  if (defId === 'sofa' || defId === 'table' || defId === 'cabinet') {
    const color = defId === 'sofa' ? '#8B7355' : defId === 'table' ? '#A0522D' : '#D2B48C'
    return (
      <mesh position={[x, 0.4, z]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.7, 0.6]} />
        <meshStandardMaterial color={color} />
      </mesh>
    )
  }

  if (defId === 'door') {
    return (
      <mesh position={[x, 1.0, z]} castShadow>
        <boxGeometry args={[0.8, 2.0, 0.05]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
    )
  }

  return (
    <mesh position={[x, 0.2, z]}>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial color="#888" />
    </mesh>
  )
}

export function TwinRenderer3D({ mapData }: { mapData: TwinMapData; patientId?: string }) {
  const entityStates = useEntityStateStore((s) => s.states)
  const tileSize = 1

  return (
    <group>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />

      {mapData.rooms.map((room) => (
        <mesh
          key={room.id}
          position={[room.x + room.w / 2, -0.01, room.y + room.h / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[room.w, room.h]} />
          <meshStandardMaterial color={room.color} />
        </mesh>
      ))}

      <WallGenerator grid={mapData.grid} tileSize={tileSize} />

      {mapData.entities.map((ent) => {
        const state = entityStates.get(ent.id)
        const x = state?.tileX ?? ent.gridX
        const y = state?.tileY ?? ent.gridY
        const z = ent.layer === 2 ? 2.5 : ent.layer === 1 ? 0.5 : 0

        return (
          <EntityMesh
            key={ent.id}
            defId={ent.defId}
            category={ent.category}
            position={[x * tileSize, z, y * tileSize]}
            orientation={ent.orientation}
          />
        )
      })}
    </group>
  )
}
