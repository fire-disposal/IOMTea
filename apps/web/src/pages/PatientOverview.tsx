import { ActionIcon, Group, Modal, Paper, SegmentedControl, Text, Tooltip } from '@mantine/core'
import { IconMaximize, IconPlayerPause, IconSpeedboat } from '@tabler/icons-react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts'
import { trpc } from '../trpc'
import { MapRenderer3D } from '../map/MapRenderer3D'
import { useMapModel } from '../map/useMapModel'

const METRICS = [
  { key: 'heart_rate', label: '心率', color: '#e03131', unit: 'bpm', domain: [40, 180] as const },
  { key: 'spo2', label: '血氧', color: '#1971c2', unit: '%', domain: [80, 100] as const },
  { key: 'systolic_bp', label: '收缩压', color: '#f08c00', unit: 'mmHg', domain: [60, 200] as const },
  { key: 'temperature', label: '体温', color: '#2f9e44', unit: '°C', domain: [35, 42] as const },
]

export function PatientOverview() {
  const { id } = useParams<{ id: string }>()
  const [timeRange, setTimeRange] = useState('6h')
  const [selectedMetric, setSelectedMetric] = useState('heart_rate')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const now = useMemo(() => new Date(), [])
  const timeMap: Record<string, number> = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 }
  const from = new Date(now.getTime() - (timeMap[timeRange] || 21600000))

  const timeseries = trpc.data.timeseries.useQuery(
    { patientId: id!, metric: selectedMetric, from: from.getTime(), to: now.getTime() },
    { enabled: !!id, refetchInterval: 10000 },
  )

  const mapModel = useMapModel(id ? [id] : [])

  const metric = METRICS.find((m) => m.key === selectedMetric)!

  const chartData = (timeseries.data || []).map((e) => ({
    time: new Date(e.recordedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    value: e.value,
  }))

  return (
    <>
      <Group align="start" gap="md" wrap="nowrap" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Left: Vitals Chart */}
        <Paper p="md" radius="md" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Group justify="space-between" mb="sm">
            <SegmentedControl
              size="xs"
              value={selectedMetric}
              onChange={(v) => setSelectedMetric(v)}
              data={METRICS.map((m) => ({ label: m.label, value: m.key }))}
            />
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
            {chartData.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" mt="xl">
                暂无数据
              </Text>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis domain={metric.domain} tick={{ fontSize: 11 }} />
                  <ReTooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={false}
                    name={`${metric.label} (${metric.unit})`}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Paper>

        {/* Right: 3D Twin Viewer */}
        <Paper p="md" radius="md" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Group justify="space-between" mb="sm">
            <Text fw={600}>数字孪生</Text>
            <Group gap={4}>
              <Tooltip label="暂停">
                <ActionIcon variant="subtle">
                  <IconPlayerPause size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="倍速">
                <ActionIcon variant="subtle">
                  <IconSpeedboat size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="全屏">
                <ActionIcon variant="subtle" onClick={() => setIsFullscreen(true)}>
                  <IconMaximize size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <div style={{ flex: 1, borderRadius: 8, overflow: 'hidden', background: '#f0f4f8' }}>
            <Canvas
              camera={{ position: [10, 12, 10], fov: 50 }}
              style={{ width: '100%', height: '100%' }}
            >
              <OrbitControls enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI / 2.2} />
              {mapModel && <MapRenderer3D model={mapModel} />}
            </Canvas>
          </div>
        </Paper>
      </Group>

      {/* Fullscreen Modal */}
      <Modal
        opened={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        fullScreen
        title="数字孪生 — 全屏"
      >
        <div style={{ width: '100%', height: 'calc(100vh - 100px)', borderRadius: 8, overflow: 'hidden', background: '#f0f4f8' }}>
          <Canvas
            camera={{ position: [10, 12, 10], fov: 50 }}
            style={{ width: '100%', height: '100%' }}
          >
            <OrbitControls enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI / 2.2} />
            {mapModel && <MapRenderer3D model={mapModel} />}
          </Canvas>
        </div>
      </Modal>
    </>
  )
}
