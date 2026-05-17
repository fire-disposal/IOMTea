import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { trpc } from '../trpc'
import { useHomeMap } from '../hooks/useHomeMap'
import { VitalsChart } from './components/VitalsChart'
import { TwinViewer3D } from '../twin3d/TwinViewer3D'
import { ScenarioModal } from './components/ScenarioModal'

const SPEEDS = [1, 2, 5, 10]

export function PatientOverview() {
  const { id } = (useParams as any)({ from: '/_auth/patients/$id' })
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState('6h')
  const [chartVisible, setChartVisible] = useState(true)
  const [scenarioOpen, setScenarioOpen] = useState(false)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(t)
  }, [])

  const timeMap: Record<string, number> = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 }
  const from = now - (timeMap[timeRange] || 21600000)
  const METRICS = ['heart_rate', 'spo2', 'systolic_bp', 'temperature']

  const tsBatch = trpc.data.timeseriesBatch.useQuery(
    { patientId: id!, metrics: METRICS, from, to: now },
    { enabled: !!id, refetchInterval: 10000 },
  )

  const { runtime: mapData, isLoading: mapLoading, error: mapError, refetch: refetchMap } = useHomeMap(id)
  const createMapMut = trpc.homeMap.generateFromTemplate.useMutation()

  const handleCreateMap = useCallback(() => {
    if (!id) return
    createMapMut.mutate({ patientId: id, templateId: 'two_bedroom' }, { onSuccess: () => refetchMap() })
  }, [id, createMapMut, refetchMap])

  const engineStatus = trpc.twin.engine.status.useQuery({ patientId: id! }, { enabled: !!id, refetchInterval: 5000 })
  const resumeMut = trpc.twin.engine.resume.useMutation()
  const pauseMut = trpc.twin.engine.pause.useMutation()
  const setSpeedMut = trpc.twin.engine.setSpeed.useMutation()
  const injectMut = trpc.twin.engine.injectScenario.useMutation()

  const es = (engineStatus.data && !Array.isArray(engineStatus.data)) ? engineStatus.data : null
  const isRunning = es?.running ?? false
  const currentSpeed = es?.speed ?? 1

  const chartData = useMemo(() => {
    const batch = tsBatch.data ?? {}
    const bucket = (ts: number) => Math.floor(ts / 60000) * 60000
    const map = new Map<number, Record<string, number>>()
    const metricKeys: Record<string, string> = { heart_rate: 'hr', spo2: 'spo2', systolic_bp: 'systolic_bp', temperature: 'temp' }
    for (const [metric, points] of Object.entries(batch)) {
      const key = metricKeys[metric]
      if (!key) continue
      for (const p of points as any[]) {
        const b = bucket(p.recordedAt)
        if (!map.has(b)) map.set(b, { ts: b })
        map.get(b)![key] = p.value
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b).map(([, d]) => d as { ts: number; hr?: number; spo2?: number; systolic_bp?: number; temp?: number })
  }, [tsBatch.data])

  const handlePlayPause = useCallback(() => {
    if (!id) return
    if (isRunning) pauseMut.mutate({ patientId: id })
    else resumeMut.mutate({ patientId: id })
  }, [id, isRunning, pauseMut, resumeMut])

  const handleSpeedCycle = useCallback(() => {
    if (!id) return
    const idx = SPEEDS.indexOf(currentSpeed)
    setSpeedMut.mutate({ patientId: id, speed: SPEEDS[(idx + 1) % SPEEDS.length] })
  }, [id, currentSpeed, setSpeedMut])

  const handleInject = useCallback((type: string) => {
    if (!id) return
    injectMut.mutate({ patientId: id, type: type as any })
    setScenarioOpen(false)
  }, [id, injectMut])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <VitalsChart
        data={chartData}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        visible={chartVisible}
        onToggle={() => setChartVisible((v) => !v)}
      />

      <TwinViewer3D
        mapRuntime={mapData}
        mapLoading={mapLoading}
        mapError={mapError}
        isRunning={isRunning}
        speed={currentSpeed}
        onCreateMap={handleCreateMap}
        onCreateMapPending={createMapMut.isPending}
        onPlayPause={handlePlayPause}
        isPausePending={pauseMut.isPending}
        isResumePending={resumeMut.isPending}
        onSpeedCycle={handleSpeedCycle}
        isSpeedPending={setSpeedMut.isPending}
        onInjectScenario={() => setScenarioOpen(true)}
        onEditMap={() => navigate({ to: '/patients/$id/map-editor', params: { id: id! } })}
      />

      <ScenarioModal
        opened={scenarioOpen}
        onClose={() => setScenarioOpen(false)}
        onInject={handleInject}
        pending={injectMut.isPending}
      />
    </div>
  )
}