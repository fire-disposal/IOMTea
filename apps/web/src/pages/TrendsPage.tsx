import { useState, useMemo } from 'react'
import { Container, Title, Group, Select, Paper, Center, Stack, Text } from '@mantine/core'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { trpc } from '../trpc'
import { StateSkeleton, StateEmpty, StateError } from '../components/shared/StateComponents'

const METRICS = [
  { value: 'heart_rate', label: '心率 (bpm)' },
  { value: 'blood_pressure_systolic', label: '收缩压 (mmHg)' },
  { value: 'weight_kg', label: '体重 (kg)' },
  { value: 'temperature', label: '体温 (°C)' },
  { value: 'spo2', label: '血氧 (%)' },
]

const TIME_RANGES = [
  { value: '7', label: '7天' },
  { value: '30', label: '30天' },
  { value: '90', label: '90天' },
]

export function TrendsPage() {
  const [patientId, setPatientId] = useState<string | null>(null)
  const [metric, setMetric] = useState<string>('heart_rate')
  const [days, setDays] = useState<string>('7')

  const patients = trpc.patient.list.useQuery({ pageSize: 100 })

  const from = Date.now() - parseInt(days) * 86400000

  const timeseries = trpc.data.timeseries.useQuery(
    { patientId: patientId!, metric, from },
    { enabled: !!patientId },
  )

  const patientOptions = useMemo(
    () => (patients.data || []).map((p: any) => ({ value: p.id, label: p.name })),
    [patients.data],
  )

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="lg">健康趋势</Title>

      <Group mb="lg">
        <Select
          placeholder="选择患者"
          data={patientOptions}
          value={patientId}
          onChange={setPatientId}
          searchable
          clearable
          miw={200}
        />
        <Select
          placeholder="选择指标"
          data={METRICS}
          value={metric}
          onChange={(v) => setMetric(v ?? 'heart_rate')}
          miw={180}
        />
        <Select
          placeholder="时间范围"
          data={TIME_RANGES}
          value={days}
          onChange={(v) => setDays(v ?? '7')}
          miw={120}
        />
      </Group>

      {!patientId && (
        <Center py={80}>
          <Stack align="center" gap="md">
            <Text c="dimmed" size="lg">请选择一个患者查看健康趋势</Text>
          </Stack>
        </Center>
      )}

      {patientId && timeseries.isLoading && <StateSkeleton variant="chart" />}
      {patientId && timeseries.isError && <StateError message="加载趋势数据失败" />}
      {patientId && !timeseries.isLoading && !timeseries.isError && (timeseries.data?.length ?? 0) === 0 && (
        <StateEmpty message="暂无数据" />
      )}
      {patientId && !timeseries.isLoading && !timeseries.isError && (timeseries.data?.length ?? 0) > 0 && (
          <Paper p="md" radius="md" withBorder>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={timeseries.data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--mantine-color-matchaGreen-6)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--mantine-color-matchaGreen-6)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="recordedAt"
                  tickFormatter={(ts: number) => new Date(ts).toLocaleDateString('zh-CN')}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip labelFormatter={(ts: any) => new Date(ts).toLocaleString('zh-CN')} />
                <Area type="monotone" dataKey="value" stroke="var(--mantine-color-matchaGreen-6)" strokeWidth={2} fill="url(#colorValue)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
      )}
    </Container>
  )
}
