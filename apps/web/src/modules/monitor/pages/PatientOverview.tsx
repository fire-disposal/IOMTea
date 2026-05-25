import { useCallback, useEffect, useMemo, useState } from 'react'
import { Stack } from '@mantine/core'
import { useParams, useNavigate } from '@tanstack/react-router'
import { api } from '../../../api/client'
import { VitalsChart } from '../components/VitalsChart'
import { GraphViewer } from '../../twin/components/twin3d/GraphViewer'
import { ScenarioModal } from '../components/ScenarioModal'

const SPEEDS = [1, 2, 5, 10]

export function PatientOverview() {
  const { id } = useParams({ from: '/_auth/patients/$id' })
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState('6h')
  const [chartVisible, setChartVisible] = useState(true)
  const [scenarioOpen, setScenarioOpen] = useState(false)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(t)
  }, [])

  const timeMap: Record<string, number> = {
    '1h': 3600000,
    '6h': 21600000,
    '24h': 86400000,
    '7d': 604800000,
  }
  const from = now - (timeMap[timeRange] || 21600000)
  const METRICS = ['heart_rate', 'spo2', 'systolic_bp', 'temperature']

  const METRICS = ['heart_rate', 'spo2', 'systolic_bp', 'temperature']

  const [batchData, setBatchData] = useState<Record<string, any[]>>({})
  const [engineStatus, setEngineStatus] = useState<any>(null)
  const [createMapLoading, setCreateMapLoading] = useState(false)
  const [pauseLoading, setPauseLoading] = useState(false)
  const [resumeLoading, setResumeLoading] = useState(false)
  const [speedLoading, setSpeedLoading] = useState(false)
  const [injectLoading, setInjectLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    const fetchBatch = async () => {
      const results: Record<string, any[]> = {}
      for (const metric of METRICS) {
        try {
          const res = await api.get<any>('/data/raw', {
            patientId: id,
            metric,
            from: new Date(from).toISOString(),
            to: new Date(now).toISOString(),
            limit: 200,
          })
          results[metric] = res.rows ?? []
        } catch {
          results[metric] = []
        }
      }
      setBatchData(results)
    }
    fetchBatch()
    const t = setInterval(fetchBatch, 10000)
    return () => clearInterval(t)
  }, [id, from, now])

  useEffect(() => {
    if (!id) return
    const fetchStatus = async () => {
      try {
        const res = await api.get<any>(`/twin/engine/${id}/status`)
        setEngineStatus(res)
      } catch { /* no engine status endpoint */ }
    }
    fetchStatus()
    const t = setInterval(fetchStatus, 5000)
    return () => clearInterval(t)
  }, [id])

  const handleCreateMap = useCallback(async () => {
    if (!id) return
    setCreateMapLoading(true)
    try {
      await api.put(`/home-graph/patients/${id}/home-graph`, {
        rooms: [{ id: 'living', name: '客厅', type: 'livingroom', x: 0, y: 0, connections: [] }],
        corridors: [],
      })
    } finally {
      setCreateMapLoading(false)
    }
  }, [id])

  const es = engineStatus && !Array.isArray(engineStatus) ? engineStatus : null
  const isRunning = es?.running ?? false
  const currentSpeed = es?.speed ?? 1

  const handlePlayPause = useCallback(async () => {
    if (!id) return
    if (isRunning) {
      setPauseLoading(true)
      try { await api.post(`/twin/engine/${id}/pause`) } catch {}
      setPauseLoading(false)
    } else {
      setResumeLoading(true)
      try { await api.post(`/twin/engine/${id}/resume`) } catch {}
      setResumeLoading(false)
    }
  }, [id, isRunning])

  const handleSpeedCycle = useCallback(async () => {
    if (!id) return
    const idx = SPEEDS.indexOf(currentSpeed)
    const newSpeed = SPEEDS[(idx + 1) % SPEEDS.length]
    setSpeedLoading(true)
    try { await api.patch('/twin/speed', { speed: newSpeed }) } catch {}
    setSpeedLoading(false)
  }, [id, currentSpeed])

  const handleInject = useCallback(async (type: string) => {
    if (!id) return
    setInjectLoading(true)
    try { await api.post(`/twin/engine/${id}/scenario`, { type }) } catch {}
    setInjectLoading(false)
    setScenarioOpen(false)
  }, [id])

  const createMapMut = trpc.homeGraph.upsert.useMutation()
  const utils = trpc.useUtils()

  const handleCreateMap = useCallback(() => {
    if (!id) return
    createMapMut.mutate(
      {
        patientId: id,
        graph: {
          rooms: [{ id: 'living', name: '客厅', type: 'livingroom', x: 0, y: 0, connections: [] }],
          entryRoomId: 'living',
          personLocation: null,
        },
      },
      { onSuccess: () => utils.homeGraph.get.invalidate({ patientId: id }) },
    )
  }, [id, createMapMut, utils])

  const engineStatus = trpc.twin.engine.status.useQuery(
    { patientId: id! },
    { enabled: !!id, refetchInterval: 5000 },
  )
  const resumeMut = trpc.twin.engine.resume.useMutation()
  const pauseMut = trpc.twin.engine.pause.useMutation()
  const setSpeedMut = trpc.twin.engine.setSpeed.useMutation()
  const injectMut = trpc.twin.engine.injectScenario.useMutation()

  const es = engineStatus.data && !Array.isArray(engineStatus.data) ? engineStatus.data : null
  const isRunning = es?.running ?? false
  const currentSpeed = es?.speed ?? 1

  const chartData = useMemo(() => {
    const batch = batchData
    const bucket = (ts: number) => Math.floor(ts / 60000) * 60000
    const map = new Map<number, Record<string, number>>()
    const metricKeys: Record<string, string> = {
      heart_rate: 'hr',
      spo2: 'spo2',
      systolic_bp: 'systolic_bp',
      temperature: 'temp',
    }
    for (const [metric, points] of Object.entries(batch)) {
      const key = metricKeys[metric]
      if (!key) continue
      for (const p of points as any[]) {
        const b = bucket(p.recordedAt)
        if (!map.has(b)) map.set(b, { ts: b })
        map.get(b)![key] = p.value
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(
        ([, d]) =>
          d as { ts: number; hr?: number; spo2?: number; systolic_bp?: number; temp?: number },
      )
  }, [batchData])

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

  const handleInject = useCallback(
    (type: string) => {
      if (!id) return
      injectMut.mutate({ patientId: id, type: type as any })
      setScenarioOpen(false)
    },
    [id, injectMut],
  )

  return (
    <Stack h="100%" gap="md">
      <VitalsChart
        data={chartData}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        visible={chartVisible}
        onToggle={() => setChartVisible((v) => !v)}
      />

      <GraphViewer
        patientId={id!}
        isRunning={isRunning}
        speed={currentSpeed}
        onCreateMap={handleCreateMap}
        onCreateMapPending={createMapLoading}
        onPlayPause={handlePlayPause}
        isPausePending={pauseLoading}
        isResumePending={resumeLoading}
        onSpeedCycle={handleSpeedCycle}
        isSpeedPending={speedLoading}
        onInjectScenario={() => setScenarioOpen(true)}
        onEditMap={() => navigate({ to: '/patients/$id/map-editor', params: { id: id! } })}
      />

      <ScenarioModal
        opened={scenarioOpen}
        onClose={() => setScenarioOpen(false)}
        onInject={handleInject}
        pending={injectLoading}
      />
    </Stack>
  )
}
