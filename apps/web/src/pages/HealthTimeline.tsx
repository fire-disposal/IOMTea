import { Container, Group, MultiSelect, Paper, Select, Skeleton } from '@mantine/core'
import { useState } from 'react'
import { useGet } from '../api/hooks'
import { GanttTimeline } from '../components/GanttTimeline'

interface M {
  metric: string
  displayName: string
  unit: string
}
function parseId() {
  return window.location.pathname.split('/patients/')[1]?.split('/')[0] || ''
}

export function HealthTimeline() {
  const pid = parseId()
  const { data: metrics } = useGet<M[]>('/data/metrics')
  const [selected, setSelected] = useState<string[]>(['heart_rate', 'spo2', 'temperature'])
  const from = new Date(Date.now() - 24 * 3600000).toISOString()
  const { data: rawData, isLoading } = useGet<{
    rows: { recordedAt: number; value: unknown; metric?: string }[]
  }>('/data/raw', { patientId: pid, metric: selected[0] || 'heart_rate', from, limit: 500 })

  const allPoints = selected.map((metric) => {
    const def = metrics?.find((m) => m.metric === metric)
    return { metric, displayName: def?.displayName ?? metric, unit: def?.unit ?? '' }
  })

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <MultiSelect
          size="sm"
          data={(metrics ?? []).map((m) => ({
            value: m.metric,
            label: `${m.displayName} (${m.unit})`,
          }))}
          value={selected}
          onChange={(v) => setSelected(v)}
          placeholder="选择指标"
          w={300}
        />
      </Group>
      <Paper p="md" withBorder>
        {isLoading ? (
          <Skeleton height={300} />
        ) : (
          <GanttTimeline
            data={(rawData?.rows ?? []).map((r) => ({
              time: r.recordedAt,
              metric: r.metric || selected[0],
              value: typeof r.value === 'number' ? r.value : 0,
              displayName:
                metrics?.find((m) => m.metric === (r.metric || selected[0]))?.displayName ??
                (r.metric || ''),
            }))}
            height={350}
          />
        )}
      </Paper>
    </Container>
  )
}
