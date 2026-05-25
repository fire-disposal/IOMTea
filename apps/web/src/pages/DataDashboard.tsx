import { Box, Container, Group, Paper, Select, Text, ThemeIcon, Title } from '@mantine/core'
import { IconChartLine } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface MetricInfo {
  metric: string
  displayName: string
  unit: string
  defaultChart: string
  category: string
}

export function DataDashboard() {
  const [metrics, setMetrics] = useState<MetricInfo[]>([])
  const [selected, setSelected] = useState('heart_rate')
  const [trend, setTrend] = useState<{ bucket: string; value: number }[]>([])

  useEffect(() => {
    http.get('/data/metrics').then((res) => setMetrics(res.data as MetricInfo[]))
  }, [])

  useEffect(() => {
    if (!selected) return
    const from = new Date(Date.now() - 7 * 86400000).toISOString()
    http
      .get('/data/aggregate', {
        params: { patientId: 'dummy', metric: selected, interval: 'day', fn: 'avg', from },
      })
      .then((res) => {
        setTrend((res.data as any)?.rows ?? [])
      })
      .catch(() => {})
  }, [selected])

  const selectedDef = metrics.find((m) => m.metric === selected)

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light">
            <IconChartLine size={14} />
          </ThemeIcon>
          <Title order={2}>数据监控</Title>
        </Group>
        <Select
          size="sm"
          data={metrics.map((m) => ({ value: m.metric, label: `${m.displayName} (${m.unit})` }))}
          value={selected}
          onChange={(v) => setSelected(v ?? 'heart_rate')}
          w={200}
        />
      </Group>
      <Paper p="md" withBorder>
        {trend.length === 0 ? (
          <Text c="dimmed" ta="center">
            No data
          </Text>
        ) : (
          <Group gap={0} align="flex-end" h={120}>
            {trend.map((r, i) => {
              const maxVal = Math.max(...trend.map((t) => t.value || 0), 1)
              const height = Math.max(4, ((r.value || 0) / maxVal) * 100)
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
                      height: `${height}%`,
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
