import { useCallback, useEffect, useMemo, useState } from 'react'
import { Stack } from '@mantine/core'
import { useParams, useNavigate } from '@tanstack/react-router'
import { api } from '../../../api/client'
import { VitalsChart } from '../components/VitalsChart'
import { GraphViewer } from '../../twin/components/twin3d/GraphViewer'
import { ScenarioModal } from '../components/ScenarioModal'

const SPEEDS = [1, 2, 5, 10]
const METRICS = ['heart_rate', 'spo2', 'systolic_bp', 'temperature']

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
          const { data: res } = await api.GET('/data/raw', {
            params: {
              query: {
                patientId: id,
                metric,
                from: new Date(from).toISOString(),
                to: new Date(now).toISOString(),
                limit: 200,
              },
            },
          })
          results[metric] = (res as any)?.rows ?? []
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
        const { data: res } = await api.GET('/twin/engine/{patientId}/status', {
          params: { path: { patientId: id } },
        })
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
      await api.PUT('/home-graph/patients/{id}/home-graph', {
        params: { path: { id } },
        body: {
          rooms: [{ id: 'living', name: '客厅', type: 'livingroom', x: 0, y: 0, connections: [] }],
          corridors: [],
        },
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
      try { await api.POST('/twin/engine/{patientId}/pause', { params: { path: { patientId: id } } }) } catch {}
      setPauseLoading(false)
    } else {
      setResumeLoading(true)
      try { await api.POST('/twin/engine/{patientId}/resume', { params: { path: { patientId: id } } }) } catch {}
      setResumeLoading(false)
    }
  }, [id, isRunning])

  const handleSpeedCycle = useCallback(async () => {
    if (!id) return
    const idx = SPEEDS.indexOf(currentSpeed)
    const newSpeed = SPEEDS[(idx + 1) % SPEEDS.length]
    setSpeedLoading(true)
    try { await api.PATCH('/twin/speed', { body: { speed: newSpeed } }) } catch {}
    setSpeedLoading(false)
  }, [id, currentSpeed])

  const handleInject = useCallback(async (type: string) => {
    if (!id) return
    setInjectLoading(true)
    try { await api.POST('/twin/engine/{patientId}/scenario', {
      params: { path: { patientId: id } },
      body: { type },
    }) } catch {}
    setInjectLoading(false)
    setScenarioOpen(false)
  }, [id])

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
