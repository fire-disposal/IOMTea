import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

interface RoomNode {
  id: string; name: string; type: string; x: number; y: number; connections: string[]
}

const ROOM_COLORS: Record<string, string> = {
  bedroom: '#8B6914', livingroom: '#6B8E23', kitchen: '#CD853F',
  bathroom: '#87CEEB', study: '#9370DB', corridor: '#B0B0B0',
  entry: '#DAA520', balcony: '#90EE90', storage: '#A9A9A9', dining: '#DEB887',
}

export function RoomGraph3D({ rooms, personRoomId }: { rooms: RoomNode[]; personRoomId?: string | null }) {
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms])

  if (rooms.length === 0) return null

  const centerX = rooms.reduce((s, r) => s + r.x, 0) / rooms.length
  const centerZ = rooms.reduce((s, r) => s + r.y, 0) / rooms.length

  return (
    <group position={[-centerX, 0, -centerZ]}>
      {rooms.map((room) => {
        const color = ROOM_COLORS[room.type] || '#888888'
        const isPersonHere = personRoomId === room.id

        return (
          <group key={room.id}>
            <mesh position={[room.x, 1.2, room.y]} castShadow>
              <boxGeometry args={[2.5, 2.4, 2.5]} />
              <meshStandardMaterial color={color} transparent opacity={0.85} />
            </mesh>
            <Html position={[room.x, 2.6, room.y]} center distanceFactor={12}>
              <div style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap', fontWeight: 500 }}>
                {room.name}
              </div>
            </Html>
            {isPersonHere && (
              <mesh position={[room.x, 1.4, room.y]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={0.5} />
              </mesh>
            )}
          </group>
        )
      })}

      {rooms.map((room) =>
        room.connections.map((connId) => {
          const target = roomMap.get(connId)
          if (!target) return null
          const key = [room.id, connId].sort().join('-')
          const points = [new THREE.Vector3(room.x, 1.2, room.y), new THREE.Vector3(target.x, 1.2, target.y)]
          const geom = new THREE.BufferGeometry().setFromPoints(points)
          const mat = new THREE.LineBasicMaterial({ color: '#666' })
          return <primitive key={key} object={new THREE.Line(geom, mat)} />
        }),
      )}
    </group>
  )
}