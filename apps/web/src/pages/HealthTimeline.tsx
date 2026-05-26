import { Container, Group, MultiSelect, Paper, Skeleton, Text } from '@mantine/core'
import { useState } from 'react'
import { useGet } from '../api/hooks'

interface MetricDef {
  metric: string
  displayName: string
  unit: string
}

interface RawRow {
  recordedAt: number
  metric: string
  value: unknown
}

import { parsePatientId } from '../lib/path'

const METRIC_LABELS: Record<string, string> = {
  heart_rate: '心率',
  spo2: '血氧',
  temperature: '体温',
  systolic_bp: '收缩压',
  diastolic_bp: '舒张压',
  glucose: '血糖',
  respiratory_rate: '呼吸率',
  motion_index: '活动指数',
}

export function HealthTimeline() {
  const pid = parsePatientId()
  const { data: metrics } = useGet<MetricDef[]>('/data/metrics')
  const [selected, setSelected] = useState<string[]>(['heart_rate', 'spo2', 'temperature'])
  const from = new Date(Date.now() - 24 * 3600000).toISOString()

  const { data: rawData, isLoading } = useGet<{
    rows: RawRow[]
  }>('/data/raw', { patientId: pid, from, limit: 2000 })

  const allRows = (rawData?.rows ?? []).filter((r) => selected.includes(r.metric))

  const metricNames: Record<string, string> = {}
  metrics?.forEach((m) => {
    metricNames[m.metric] = m.displayName
  })

  return (
    <Container py="md">
      <Group mb="md">
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
        ) : allRows.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            所选指标暂无数据
          </Text>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 4 }}>时间</th>
                  <th style={{ textAlign: 'left', padding: 4 }}>指标</th>
                  <th style={{ textAlign: 'left', padding: 4 }}>值</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 4, fontSize: 12 }}>
                      {new Date(r.recordedAt).toLocaleString()}
                    </td>
                    <td style={{ padding: 4, fontSize: 12 }}>
                      {metricNames[r.metric] || r.metric}
                    </td>
                    <td style={{ padding: 4 }}>{String(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Paper>
    </Container>
  )
}
