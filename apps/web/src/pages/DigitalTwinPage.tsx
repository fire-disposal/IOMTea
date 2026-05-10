import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { HomeScene } from '../3d/scenes/HomeScene'
import { Container, Loader, Text } from '@mantine/core'
import { trpc } from '../trpc'
import { useSimData } from '../3d/hooks/useSimData'

export function DigitalTwinPage() {
  const { data: patients, isLoading } = trpc.patient.list.useQuery(
    { pageSize: 20, status: 'active' },
    { refetchInterval: 10000 },
  )
  const patientIds = (patients as any[] | undefined)?.map((p: any) => p.id) || []
  const { patientData, isLoading: simLoading } = useSimData(patientIds)

  if (isLoading) {
    return (
      <Container py="xl">
        <Loader />
        <Text mt="md">加载患者数据...</Text>
      </Container>
    )
  }

  return (
    <Container fluid p={0} style={{ height: 'calc(100vh - 120px)' }}>
      <Canvas
        camera={{ position: [15, 12, 15], fov: 50 }}
        shadows
        style={{ background: '#1a1a2e' }}
      >
        <HomeScene patientData={patientData} />
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
