import {
  Badge,
  Container,
  Group,
  MultiSelect,
  Paper,
  Select,
  Skeleton,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { IconChartLine } from '@tabler/icons-react'
import { useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts'
import { useGet } from '../api/hooks'
import { useRealtime } from '../hooks/useRealtime'

interface M {
  metric: string
  displayName: string
  unit: string
}
interface Patient {
  id: string
  name: string
}

export function DataDashboard() {
  const { data: patients } = useGet<Patient[]>('/patients', { pageSize: 200 })
  const { data: metrics } = useGet<M[]>('/data/metrics')
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['heart_rate', 'spo2'])
  const [liveData, setLiveData] = useState<Record<string, number>>({})

  useRealtime({
    patientId: selectedPatient || undefined,
    onVitals: (data) => {
      setLiveData((prev) => {
        const next = { ...prev }
        data.metrics.forEach((m) => {
          next[m.metric] = m.value
        })
        return next
      })
    },
  })

  const from = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: trend, isLoading } = useGet<{ rows: { bucket: string; value: number }[] }>(
    '/data/aggregate',
    {
      patientId: selectedPatient || (patients?.[0]?.id ?? ''),
      metric: selectedMetrics[0] || 'heart_rate',
      interval: 'day',
      fn: 'avg',
      from,
    },
    undefined,
  )

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light">
            <IconChartLine size={14} />
          </ThemeIcon>
          <Title order={2}>数据监控</Title>
        </Group>
        <Group>
          <Select
            size="sm"
            placeholder="选择患者"
            data={(patients ?? []).map((p) => ({ value: p.id, label: p.name }))}
            value={selectedPatient}
            onChange={setSelectedPatient}
            clearable
            w={200}
          />
          <MultiSelect
            size="sm"
            data={(metrics ?? []).map((m) => ({ value: m.metric, label: m.displayName }))}
            value={selectedMetrics}
            onChange={setSelectedMetrics}
            placeholder="指标"
            w={250}
          />
        </Group>
      </Group>
      <Paper p="md" withBorder>
        {isLoading ? (
          <Skeleton height={300} />
        ) : !trend?.rows?.length ? (
          <Text c="dimmed" ta="center" py="md">
            {selectedPatient ? '暂无数据' : '请选择患者和指标'}
          </Text>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trend.rows}>
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <ReTooltip />
              <Bar dataKey="value" fill="var(--mantine-color-teal-5)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Paper>
      <Group mt="md">
        <Badge color="green" variant="light">
          {Object.keys(liveData).length > 0 ? '实时数据已连接' : '等待实时数据...'}
        </Badge>
        {Object.entries(liveData).map(([k, v]) => (
          <Badge key={k} variant="outline">
            {k}: {v}
          </Badge>
        ))}
      </Group>
    </Container>
  )
}
