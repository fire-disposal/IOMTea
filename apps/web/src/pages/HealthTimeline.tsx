import { Container, Title, Paper, Select, Group, Box, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface MetricDef { metric: string; displayName: string; unit: string }

export function HealthTimeline({ patientId }: { patientId: string }) {
  const [metrics, setMetrics] = useState<MetricDef[]>([])
  const [selected, setSelected] = useState('heart_rate')
  const [trend, setTrend] = useState<{ recordedAt: number; numericValue: number }[]>([])

  useEffect(() => {
    http.get('/data/metrics').then((r) => setMetrics(r.data as MetricDef[]))
  }, [])

  useEffect(() => {
    if (!selected) return
    const from = new Date(Date.now() - 7 * 86400000).toISOString()
    http.get('/data/raw', { params: { patientId, metric: selected, from, limit: 200 } }).then((r) => {
      setTrend((r.data as any).rows ?? [])
    })
  }, [patientId, selected])

  const def = metrics.find((m) => m.metric === selected)

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={3}>健康时间线</Title>
        <Select size="sm" data={metrics.map((m) => ({ value: m.metric, label: `${m.displayName} (${m.unit})` }))} value={selected} onChange={(v) => setSelected(v ?? 'heart_rate')} w={200} />
      </Group>
      <Paper p="md" withBorder>
        {trend.length === 0 ? <Text c="dimmed" ta="center">No data</Text> : (
          <Group gap={0} align="flex-end" h={120}>
            {trend.map((r, i) => {
              const maxVal = Math.max(...trend.map((t) => t.numericValue || 0), 1)
              const height = Math.max(4, ((r.numericValue || 0) / maxVal) * 100)
              return (
                <Box key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <Text size="xs" c="dimmed">{r.numericValue?.toFixed?.(1) ?? '-'}</Text>
                  <Box style={{ width: '80%', height: `${height}%`, backgroundColor: 'var(--mantine-color-teal-5)', borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                </Box>
              )
            })}
          </Group>
        )}
      </Paper>
    </Container>
  )
}
