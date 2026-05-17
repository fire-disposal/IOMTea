import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import type { ReactNode } from 'react'

interface TwinScene3DProps {
  children?: ReactNode
  showGizmo?: boolean
  showGrid?: boolean
  centerX?: number
  centerZ?: number
}

export function TwinScene3D({
  children,
  showGizmo = false,
  showGrid = false,
  centerX = 0,
  centerZ = 0,
}: TwinScene3DProps) {
  return (
    <Canvas
      camera={{ position: [centerX + 8, 14, centerZ + 10], fov: 45, near: 0.3, far: 80 }}
      style={{ width: '100%', height: '100%', background: '#e0dcd0' }}
      shadows
    >
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[15, 25, 10]}
        intensity={0.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <hemisphereLight args={['#fff8e8', '#8d7c6b', 0.35]} />

      <OrbitControls
        target={[centerX, 0, centerZ]}
        maxPolarAngle={Math.PI / 2.3}
        minDistance={4}
        maxDistance={35}
        enableDamping
        dampingFactor={0.08}
        mouseButtons={{ LEFT: undefined, MIDDLE: 2, RIGHT: 0 }}
      />

      {showGizmo && (
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#d32f2f', '#4caf50', '#1976d2']} labelColor="#333" />
        </GizmoHelper>
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, -0.02, centerZ]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#d8d0c0" />
      </mesh>

      {children}
    </Canvas>
  )
}