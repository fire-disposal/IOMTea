/// <reference types="@react-three/fiber" />
import { RoomGenerator } from '../rooms/RoomGenerator'
import { homeLayout } from '../layouts/homeLayout'

export function HomeScene() {
  return (
    <group>
      <ambientLight intensity={0.4} />
      <directionalLight position={[15, 20, 10]} intensity={0.8} castShadow />
      {homeLayout.map((room) => (
        <RoomGenerator key={room.name} layout={room} />
      ))}
    </group>
  )
}
