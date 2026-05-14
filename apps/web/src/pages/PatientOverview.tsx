import { ActionIcon, Badge, Button, Group, Modal, Paper, SegmentedControl, SimpleGrid, Text, Tooltip } from '@mantine/core'
import { IconMaximize, IconPlayerPause, IconPlayerPlay, IconSpeedboat, IconBolt } from '@tabler/icons-react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Legend } from 'recharts'
import { trpc } from '../trpc'
import { MapRenderer3D } from '../map/MapRenderer3D'
import { MapRenderer2D } from '../map/MapRenderer2D'
import { useMapModel } from '../map/useMapModel'

const SCENARIOS = [
  { key: 'tachycardia', label: '心动过速', desc: 'HR 155 bpm' },
  { key: 'low_spo2', label: '低血氧', desc: 'SpO2 88%' },
  { key: 'hypotension', label: '低血压', desc: '收缩压 85' },
  { key: 'fall', label: '跌倒检测', desc: '触发跌倒告警' },
  { key: 'bed_exit', label: '离床', desc: '触发离床告警' },
  { key: 'hyperglycemia', label: '高血糖', desc: '血糖 13.5' },
  { key: 'hypoglycemia', label: '低血糖', desc: '血糖 2.8' },
  { key: 'arrhythmia', label: '心律失常', desc: 'HR 180 bpm' },
  { key: 'respiratory_distress', label: '呼吸窘迫', desc: 'RR 35 rpm' },
]

const SPEEDS = [1, 2, 5, 10]

export function PatientOverview() {
  const { id } = useParams<{ id: string }>()
  const [timeRange, setTimeRange] = useState('6h')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [scenarioOpen, setScenarioOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(t)
  }, [])

  const timeMap: Record<string, number> = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 }
  const from = now - (timeMap[timeRange] || 21600000)

  const hrQuery = trpc.data.timeseries.useQuery(
    { patientId: id!, metric: 'heart_rate', from, to: now },
    { enabled: !!id, refetchInterval: 10000 },
  )
  const spo2Query = trpc.data.timeseries.useQuery(
    { patientId: id!, metric: 'spo2', from, to: now },
    { enabled: !!id, refetchInterval: 10000 },
  )
  const bpQuery = trpc.data.timeseries.useQuery(
    { patientId: id!, metric: 'systolic_bp', from, to: now },
    { enabled: !!id, refetchInterval: 10000 },
  )
  const tempQuery = trpc.data.timeseries.useQuery(
    { patientId: id!, metric: 'temperature', from, to: now },
    { enabled: !!id, refetchInterval: 10000 },
  )

  const mapModel = useMapModel(id ? [id] : [])

  const engineStatus = trpc.twin.engine.status.useQuery(
    { patientId: id! },
    { enabled: !!id, refetchInterval: 5000 },
  )

  const resumeMut = trpc.twin.engine.resume.useMutation()
  const pauseMut = trpc.twin.engine.pause.useMutation()
  const setSpeedMut = trpc.twin.engine.setSpeed.useMutation()
  const injectMut = trpc.twin.engine.injectScenario.useMutation()

  const chartData = useMemo(() => {
    const bucket = (ts: number) => Math.floor(ts / 60000) * 60000
    const map = new Map<number, any>()

    const add = (arr: any[] | undefined, key: string) => {
      if (!arr) return
      for (const e of arr) {
        const b = bucket(e.recordedAt)
        if (!map.has(b)) map.set(b, { ts: b })
        map.get(b)![key] = e.value
      }
    }

    add(hrQuery.data, 'hr')
    add(spo2Query.data, 'spo2')
    add(bpQuery.data, 'systolic_bp')
    add(tempQuery.data, 'temp')

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([, d]) => d)
  }, [hrQuery.data, spo2Query.data, bpQuery.data, tempQuery.data])

  const patientDataMap = useMemo(() => {
    if (!id) return undefined
    const getLast = (arr: any[] | undefined): number | null =>
      arr?.length ? arr[arr.length - 1].value : null
    return new Map([[
      id,
      {
        heartRate: getLast(hrQuery.data),
        spO2: getLast(spo2Query.data),
        systolicBP: getLast(bpQuery.data),
        diastolicBP: null,
      },
    ]])
  }, [id, hrQuery.data, spo2Query.data, bpQuery.data])

  const es = (engineStatus.data && !Array.isArray(engineStatus.data)) ? engineStatus.data : null
  const isRunning = es?.running ?? false
  const currentSpeed = es?.speed ?? 1

  const handlePlayPause = useCallback(() => {
    if (!id) return
    if (isRunning) {
      pauseMut.mutate({ patientId: id })
    } else {
      resumeMut.mutate({ patientId: id })
    }
  }, [id, isRunning, pauseMut, resumeMut])

  const handleSpeedCycle = useCallback(() => {
    if (!id) return
    const idx = SPEEDS.indexOf(currentSpeed)
    const next = SPEEDS[(idx + 1) % SPEEDS.length]
    setSpeedMut.mutate({ patientId: id, speed: next })
  }, [id, currentSpeed, setSpeedMut])

  const handleInject = useCallback((type: string) => {
    if (!id) return
    injectMut.mutate({ patientId: id, type: type as any })
    setScenarioOpen(false)
  }, [id, injectMut])

  const hasData = (hrQuery.data || []).length > 0
    || (spo2Query.data || []).length > 0
    || (bpQuery.data || []).length > 0
    || (tempQuery.data || []).length > 0

  return (
    <>
      <Group align="start" gap="md" wrap="nowrap" style={{ height: 'calc(100vh - 200px)' }}>
        <Paper p="md" radius="md" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Group justify="space-between" mb="sm">
            <Text fw={600}>生命体征趋势</Text>
            <SegmentedControl
              size="xs"
              value={timeRange}
              onChange={(v) => setTimeRange(v)}
              data={[
                { label: '1h', value: '1h' },
                { label: '6h', value: '6h' },
                { label: '24h', value: '24h' },
                { label: '7d', value: '7d' },
              ]}
            />
          </Group>

          <div style={{ flex: 1 }}>
            {!hasData ? (
              <Text c="dimmed" size="sm" ta="center" mt="xl">暂无数据</Text>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={['auto', 'auto']}
                    tickFormatter={(ts) =>
                      new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                    }
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis yAxisId="vitals" domain={[40, 200]} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="pct" orientation="right" domain={[35, 100]} tick={{ fontSize: 11 }} />
                  <ReTooltip labelFormatter={(ts) => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} />
                  <Legend />
                  <Line yAxisId="vitals" type="monotone" dataKey="hr" stroke="#e03131" strokeWidth={2}
                    dot={false} name="心率 (bpm)" connectNulls />
                  <Line yAxisId="vitals" type="monotone" dataKey="systolic_bp" stroke="#f08c00" strokeWidth={2}
                    dot={false} name="收缩压 (mmHg)" connectNulls />
                  <Line yAxisId="pct" type="monotone" dataKey="spo2" stroke="#1971c2" strokeWidth={2}
                    dot={false} name="血氧 (%)" connectNulls />
                  <Line yAxisId="pct" type="monotone" dataKey="temp" stroke="#2f9e44" strokeWidth={1.5}
                    dot={false} name="体温 (°C)" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Paper>

        <Paper p="md" radius="md" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Group justify="space-between" mb="sm">
            <Group gap={8}>
              <Text fw={600}>数字孪生</Text>
              <Badge color={isRunning ? 'green' : 'gray'} variant="light" size="sm">
                {isRunning ? '运行中' : '已暂停'}
              </Badge>
              <Badge variant="outline" size="sm">{currentSpeed}x</Badge>
            </Group>
            <Group gap={4}>
              <Tooltip label={isRunning ? '暂停' : '播放'}>
                <ActionIcon
                  variant="subtle"
                  onClick={handlePlayPause}
                  loading={pauseMut.isPending || resumeMut.isPending}
                >
                  {isRunning ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}
                </ActionIcon>
              </Tooltip>
              <Tooltip label={
                `倍速 ${currentSpeed}x \u2192 ${SPEEDS[(SPEEDS.indexOf(currentSpeed) + 1) % SPEEDS.length]}x`
              }>
                <ActionIcon
                  variant="subtle"
                  onClick={handleSpeedCycle}
                  loading={setSpeedMut.isPending}
                >
                  <IconSpeedboat size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="场景注入">
                <ActionIcon
                  variant="subtle"
                  onClick={() => setScenarioOpen(true)}
                  color="orange"
                >
                  <IconBolt size={18} />
                </ActionIcon>
              </Tooltip>
              <SegmentedControl
                size="xs"
                value={viewMode}
                onChange={(v) => setViewMode(v as '3d' | '2d')}
                data={[{ label: '3D', value: '3d' }, { label: '2D', value: '2d' }]}
              />
              <Tooltip label="全屏">
                <ActionIcon variant="subtle" onClick={() => setIsFullscreen(true)}>
                  <IconMaximize size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <div style={{ flex: 1, borderRadius: 8, overflow: 'hidden', background: '#f0f4f8' }}>
            {viewMode === '3d' ? (
              <Canvas camera={{ position: [10, 12, 10], fov: 50 }} style={{ width: '100%', height: '100%' }}>
                <OrbitControls enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI / 2.2} />
                {mapModel && <MapRenderer3D model={mapModel} patientDataMap={patientDataMap} />}
              </Canvas>
            ) : (
              <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                {mapModel && <MapRenderer2D model={mapModel} />}
              </div>
            )}
          </div>
        </Paper>
      </Group>

      <Modal opened={scenarioOpen} onClose={() => setScenarioOpen(false)} title="场景注入" size="lg">
        <SimpleGrid cols={3} spacing="sm">
          {SCENARIOS.map((s) => (
            <Button
              key={s.key}
              variant="light"
              color="orange"
              onClick={() => handleInject(s.key)}
              loading={injectMut.isPending}
              styles={{ root: { height: 'auto', padding: '12px 8px', flexDirection: 'column', gap: 4 } }}
            >
              <Text size="sm" fw={600}>{s.label}</Text>
              <Text size="xs" c="dimmed">{s.desc}</Text>
            </Button>
          ))}
        </SimpleGrid>
      </Modal>

      <Modal opened={isFullscreen} onClose={() => setIsFullscreen(false)} fullScreen title="数字孪生 — 全屏">
        <div style={{ width: '100%', height: 'calc(100vh - 100px)', borderRadius: 8, overflow: 'hidden', background: '#f0f4f8' }}>
          {viewMode === '3d' ? (
            <Canvas camera={{ position: [10, 12, 10], fov: 50 }} style={{ width: '100%', height: '100%' }}>
              <OrbitControls enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI / 2.2} />
              {mapModel && <MapRenderer3D model={mapModel} patientDataMap={patientDataMap} />}
            </Canvas>
          ) : (
            <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              {mapModel && <MapRenderer2D model={mapModel} />}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
