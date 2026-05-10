import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { HomeScene } from '../3d/scenes/HomeScene'
import { Container } from '@mantine/core'

export function DigitalTwinPage() {
  return (
    <Container fluid p={0} style={{ height: 'calc(100vh - 120px)' }}>
      <Canvas
        camera={{ position: [15, 12, 15], fov: 50 }}
        shadows
        style={{ background: '#1a1a2e' }}
      >
        <HomeScene />
        <OrbitControls
          target={[5, 0, 5]}
          maxPolarAngle={Math.PI / 2.5}
          minDistance={5}
          maxDistance={30}
        />
      </Canvas>
    </Container>
  )
}
