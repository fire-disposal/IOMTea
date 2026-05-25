import {
  Box,
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
import { useGet } from '../api/hooks'

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
    selectedPatient ? undefined : undefined,
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
          <Skeleton height={120} />
        ) : !trend?.rows?.length ? (
          <Text c="dimmed" ta="center">
            {selectedPatient ? '暂无数据' : '请选择患者和指标'}
          </Text>
        ) : (
          <Group gap={0} align="flex-end" h={120}>
            {trend.rows.map((r, i) => {
              const maxV = Math.max(...trend.rows.map((t) => t.value || 0), 1)
              return (
                <Box
                  key={i}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%',
                  }}
                >
                  <Text size="xs" c="dimmed">
                    {r.value?.toFixed?.(1) ?? '-'}
                  </Text>
                  <Box
                    style={{
                      width: '80%',
                      height: `${Math.max(4, ((r.value || 0) / maxV) * 100)}%`,
                      backgroundColor: 'var(--mantine-color-teal-5)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: 4,
                    }}
                  />
                </Box>
              )
            })}
          </Group>
        )}
      </Paper>
    </Container>
  )
}
