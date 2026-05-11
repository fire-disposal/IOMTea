import { Container, Loader, Text } from '@mantine/core'
import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Component, type ReactNode, useMemo } from 'react'
import { useMapModel } from '../map/useMapModel'
import { MapRenderer3D } from '../map/MapRenderer3D'
import { useSimData } from '../3d/hooks/useSimData'
import { trpc } from '../trpc'

class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message || '未知渲染错误' }
  }
  componentDidCatch(error: Error) {
    console.error('[DigitalTwin] 3D scene error:', error)
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <Container py="xl" ta="center">
            <Text c="red" fw={500}>3D 场景渲染失败</Text>
            <Text size="sm" c="dimmed" mt="xs">{this.state.errorMsg}</Text>
            <Text size="xs" c="dimmed" mt="md">请检查浏览器是否支持 WebGL，或刷新页面重试</Text>
          </Container>
        )
      )
    }
    return this.props.children
  }
}

export function DigitalTwinPage() {
  const { data: patients, isLoading: patientsLoading } = trpc.patient.list.useQuery(
    { pageSize: 20, status: 'active' },
    { refetchInterval: 10000 },
  )

  const patientIds = (patients as any[] | undefined)?.map((p: any) => p.id) || []
  const model = useMapModel(patientIds)

  const { patientData, isLoading: simLoading } = useSimData(patientIds)

  const patientDataMap = useMemo(() => {
    const map = new Map()
    for (const pd of patientData) {
      map.set(pd.patientId, {
        heartRate: pd.heartRate,
        spO2: pd.spO2,
        systolicBP: pd.systolicBP,
        diastolicBP: pd.diastolicBP,
      })
    }
    return map
  }, [patientData])

  const liveModel = useMemo(() => {
    const alertPatientIds = new Set(
      patientData.filter((pd) => pd.alerts.length > 0).map((pd) => pd.patientId),
    )
    const alertSeverity = new Map(
      patientData
        .filter((pd) => pd.alerts.length > 0)
        .map((pd) => [pd.patientId, pd.alerts.some((a) => a.severity === 'critical') ? 'alert' : 'warning'] as const),
    )
    const entities = model.entities.map((ent) => {
      if (ent.defId !== 'mattress_sensor' || !ent.patientId) return ent
      if (alertPatientIds.has(ent.patientId)) {
        return { ...ent, status: alertSeverity.get(ent.patientId) || 'warning' }
      }
      return ent
    })
    return { ...model, entities }
  }, [model, patientData])

  if (patientsLoading) {
    return (
      <Container py="xl">
        <Loader />
        <Text mt="md">加载患者数据...</Text>
      </Container>
    )
  }

  if (model.zones.length === 0) {
    return (
      <Container py="xl" ta="center">
        <Text c="dimmed">暂无地图数据</Text>
      </Container>
    )
  }

  return (
    <Container size="responsive" p={0} style={{ height: 'calc(100vh - 120px)' }}>
      {simLoading && (
        <Container py="md" ta="center">
          <Loader size="sm" />
          <Text size="sm" c="dimmed" mt="xs">加载体征数据...</Text>
        </Container>
      )}
      <ErrorBoundary>
        <Canvas
          camera={{ position: [20, 15, 20], fov: 50 }}
          shadows
          style={{ background: '#1a1a2e' }}
          gl={{ preserveDrawingBuffer: false, antialias: true }}
          onCreated={({ gl }) => { gl.setClearColor('#1a1a2e') }}
        >
          <MapRenderer3D model={liveModel} patientDataMap={patientDataMap} />
          <OrbitControls
            target={[7, 0, 5]}
            maxPolarAngle={Math.PI / 2.5}
            minDistance={5}
            maxDistance={40}
            enableDamping
            dampingFactor={0.1}
          />
        </Canvas>
      </ErrorBoundary>
    </Container>
  )
}
