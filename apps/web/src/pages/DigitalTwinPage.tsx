import { Container, Group, SegmentedControl, Select, Badge, Loader, Text, Paper } from '@mantine/core'
import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Component, type ReactNode, useMemo, useState } from 'react'
import { useMapModel } from '../map/useMapModel'
import { MapRenderer3D } from '../map/MapRenderer3D'
import { MapRenderer2D } from '../map/MapRenderer2D'
import { useSimData } from '../3d/hooks/useSimData'
import { useEntityStateStore } from '../store/entityState'
import { useWardStore } from '../store/ward'
import { getZoneDef } from '@iomtea/shared-types/map'
import { trpc } from '../trpc'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; msg: string }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false, msg: '' } }
  static getDerivedStateFromError(e: Error) { return { hasError: true, msg: e.message || '未知错误' } }
  render() {
    if (this.state.hasError) return <Container py="xl" ta="center"><Text c="red" fw={500}>场景渲染失败</Text><Text size="sm" c="dimmed" mt="xs">{this.state.msg}</Text></Container>
    return this.props.children
  }
}

type ViewMode = '3d' | '2d'

export function DigitalTwinPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('3d')
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)

  const { data: patients, isLoading: patientsLoading } = trpc.patient.list.useQuery({ pageSize: 20, status: 'active' }, { refetchInterval: 10000 })
  const patientIds = (patients as any[] | undefined)?.map((p: any) => p.id) || []
  const selectedWardId = useWardStore((s) => s.selectedWardId)
  const wsConnected = useWardStore((s) => s.wsConnected)
  const entityStates = useEntityStateStore((s) => s.states)
  const simTime = useEntityStateStore((s) => s.simTime)

  const model = useMapModel(patientIds, selectedWardId || undefined)
  const { patientData, isLoading: simLoading } = useSimData(patientIds)

  const patientDataMap = useMemo(() => {
    const m = new Map()
    for (const pd of patientData) m.set(pd.patientId, { heartRate: pd.heartRate, spO2: pd.spO2, systolicBP: pd.systolicBP, diastolicBP: pd.diastolicBP })
    return m
  }, [patientData])

  const entityStatusMap = useMemo(() => {
    const m = new Map<string, 'normal' | 'warning' | 'alert'>()
    for (const pd of patientData) {
      if (pd.alerts.length > 0) {
        const s = pd.alerts.some((a) => a.severity === 'critical') ? 'alert' as const : 'warning' as const
        for (const ent of model.entities) {
          if (ent.defId === 'mattress_sensor' && ent.patientId === pd.patientId) m.set(ent.id, s)
        }
      }
    }
    return m
  }, [patientData, model.entities])

  const roomOptions = useMemo(() =>
    model.zones.map((z) => ({ value: z.id, label: z.name || getZoneDef(z.defId)?.label || z.id })),
    [model.zones],
  )

  const selectedZone = useMemo(() => model.zones.find((z) => z.id === selectedRoom), [model.zones, selectedRoom])

  const cameraTarget: [number, number, number] = selectedZone
    ? [(selectedZone.bounds.x1 + selectedZone.bounds.x2 + 1) / 2 * model.tileSize, 0, (selectedZone.bounds.y1 + selectedZone.bounds.y2 + 1) / 2 * model.tileSize]
    : [7, 0, 5]

  if (patientsLoading) return <Container py="xl"><Loader /><Text mt="md">加载患者数据...</Text></Container>
  if (model.zones.length === 0) return <Container py="xl" ta="center"><Text c="dimmed">暂无地图数据</Text></Container>

  return (
    <Container fluid p={0} style={{ height: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column' }}>
      <Group px="md" py={4} gap="xs" style={{ flexShrink: 0 }}>
        <SegmentedControl size="xs" value={viewMode} onChange={(v) => setViewMode(v as ViewMode)} data={[{ value: '3d', label: '3D' }, { value: '2d', label: '2D' }]} />
        <Select size="xs" data={roomOptions} value={selectedRoom} onChange={setSelectedRoom} placeholder="全部房间" clearable w={140} />
        <Badge size="xs" color={wsConnected ? 'green' : 'orange'} variant="light">{wsConnected ? '实时' : '轮询'}</Badge>
        {simTime && <Badge size="xs" color="blue" variant="light">虚拟 {new Date(simTime.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Badge>}
      </Group>

      {simLoading && <Container py="md" ta="center"><Loader size="sm" /><Text size="sm" c="dimmed" mt="xs">加载体征数据...</Text></Container>}

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {viewMode === '3d' ? (
          <ErrorBoundary>
            <Canvas camera={{ position: [20, 15, 20], fov: 50 }} shadows style={{ background: '#1a1a2e' }} gl={{ preserveDrawingBuffer: false, antialias: true }}>
              <MapRenderer3D model={model} patientDataMap={patientDataMap} entityStatusMap={entityStatusMap} />
              <OrbitControls target={cameraTarget} maxPolarAngle={Math.PI / 2.5} minDistance={3} maxDistance={40} enableDamping dampingFactor={0.1} />
            </Canvas>
          </ErrorBoundary>
        ) : (
          <div style={{ height: '100%', overflow: 'auto', padding: 8 }}>
            <MapRenderer2D model={model} cellSize={36} showGrid runtimes={entityStates as any} />
          </div>
        )}
      </div>
    </Container>
  )
}
