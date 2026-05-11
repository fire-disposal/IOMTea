import { Container, Group, Loader, Paper, Select, Text, Title } from '@mantine/core'
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { trpc } from '../trpc'
import { usePatientStore } from '../store/patients'

const METRICS = [
  { value: 'heart_rate', label: '心率 (HR)', unit: 'bpm', color: '#e03131' },
  { value: 'resp_rate', label: '呼吸率 (RR)', unit: 'rpm', color: '#1971c2' },
  { value: 'spo2', label: '血氧 (SpO2)', unit: '%', color: '#2f9e44' },
  { value: 'temperature', label: '体温', unit: '°C', color: '#f08c00' },
  { value: 'systolic_bp', label: '收缩压', unit: 'mmHg', color: '#9c36b5' },
  { value: 'diastolic_bp', label: '舒张压', unit: 'mmHg', color: '#7950f2' },
  { value: 'glucose', label: '血糖', unit: 'mmol/L', color: '#e8590c' },
  { value: 'motion_index', label: '体动指数', unit: 'g', color: '#0c8599' },
]

const RANGES = [
  { value: '3600000', label: '最近 1 小时' },
  { value: '21600000', label: '最近 6 小时' },
  { value: '86400000', label: '最近 24 小时' },
  { value: '604800000', label: '最近 7 天' },
]

export function TrendsPage() {
  const selectedPatient = usePatientStore((s) => s.selectedPatientId)
  const selectPatient = usePatientStore((s) => s.selectPatient)
  const patients = usePatientStore((s) => s.patients)
  const [selectedMetric, setSelectedMetric] = useState<string | null>('heart_rate')
  const [selectedRange, setSelectedRange] = useState<string | null>('3600000')

  const timeRangeMs = Number.parseInt(selectedRange || '3600000', 10)
  const now = Date.now()
  const from = now - timeRangeMs

  const patientOptions = useMemo(
    () => patients.map((p) => ({ value: p.id, label: p.name })),
    [patients],
  )

  const timeseries = trpc.data.timeseries.useQuery(
    {
      patientId: selectedPatient || '',
      metric: selectedMetric || '',
      from,
      to: now,
    },
    {
      enabled: !!selectedPatient && !!selectedMetric,
      refetchInterval: selectedPatient ? 10000 : false,
    },
  )

  const alerts = trpc.alert.list.useQuery(
    {
      patientId: selectedPatient || undefined,
      pageSize: 100,
      from,
    },
    {
      enabled: !!selectedPatient,
      refetchInterval: selectedPatient ? 10000 : false,
    },
  )

  const metricInfo = METRICS.find((m) => m.value === selectedMetric)

  const chartData = useMemo(() => {
    if (!timeseries.data) return []
    return timeseries.data
      .filter((d: any) => d.value != null)
      .map((d: any) => ({
        time: new Date(d.recordedAt).getTime(),
        value: d.value,
        label: new Date(d.recordedAt).toLocaleTimeString(),
      }))
      .sort((a: any, b: any) => a.time - b.time)
  }, [timeseries.data])

  const alertMarkers = useMemo(() => {
    if (!alerts.data || !chartData.length) return []
    return alerts.data
      .filter((a: any) => a.recordedAt != null)
      .map((a: any) => {
        const ts =
          typeof a.recordedAt === 'number' ? a.recordedAt : new Date(a.recordedAt).getTime()
        let value: number | undefined
        if (chartData.length > 0) {
          const closest = chartData.reduce((prev: any, curr: any) =>
            Math.abs(curr.time - ts) < Math.abs(prev.time - ts) ? curr : prev,
          )
          value = closest.value
        }
        return { time: ts, value, severity: a.severity, message: a.tags?.message || a.metric }
      })
  }, [alerts.data, chartData])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    if (timeRangeMs > 86400000)
      return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Container size="xl" py="md">
      <Title order={4} mb="md">
        趋势分析
      </Title>

      <Group mb="md" gap="sm" wrap="wrap">
        <Select data={patientOptions} value={selectedPatient} onChange={selectPatient} placeholder="选择患者" searchable clearable w={{ base: '100%', sm: 200 }} />
        <Select data={METRICS} value={selectedMetric} onChange={setSelectedMetric} placeholder="选择指标" w={{ base: '100%', sm: 180 }} />
        <Select data={RANGES} value={selectedRange} onChange={setSelectedRange} placeholder="时间范围" w={{ base: '100%', sm: 160 }} />
      </Group>

      {!selectedPatient && (
        <Paper p="xl" withBorder>
          <Text ta="center" c="dimmed">
            请选择患者和指标以查看趋势数据
          </Text>
        </Paper>
      )}

      {selectedPatient && timeseries.isLoading && (
        <Paper p="xl" withBorder>
          <Group justify="center">
            <Loader size="sm" />
            <Text c="dimmed">加载趋势数据...</Text>
          </Group>
        </Paper>
      )}

      {selectedPatient && !timeseries.isLoading && chartData.length === 0 && (
        <Paper p="xl" withBorder>
          <Text ta="center" c="dimmed">
            所选时间范围内暂无数据
          </Text>
        </Paper>
      )}

      {chartData.length > 0 && (
        <Paper p="md" withBorder>
          <Text size="sm" fw={500} mb="xs">
            {metricInfo?.label} ({metricInfo?.unit})
          </Text>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                stroke="#adb5bd"
                fontSize={12}
                minTickGap={60}
              />
              <YAxis stroke="#adb5bd" fontSize={12} />
              <Tooltip
                labelFormatter={(label: any) => new Date(label as number).toLocaleString('zh-CN')}
                formatter={(value: any) => [value, metricInfo?.label || '']}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={metricInfo?.color || '#228be6'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              {alertMarkers.map((marker, i) => (
                <ReferenceLine
                  key={i}
                  x={marker.time}
                  stroke={marker.severity === 'critical' ? '#e03131' : '#f08c00'}
                  strokeDasharray="4 4"
                  label=""
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {alertMarkers.length > 0 && (
            <Group mt="sm" gap="xs">
              <Text size="xs" c="dimmed">
                竖线标记为告警时间点
              </Text>
              <Text size="xs" c="red">
                ● critical
              </Text>
              <Text size="xs" c="orange">
                ● warning
              </Text>
            </Group>
          )}
        </Paper>
      )}
    </Container>
  )
}
