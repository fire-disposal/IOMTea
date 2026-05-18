import { Badge, Group, Paper, SegmentedControl, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { trpc } from '../trpc'

const METRICS = ['heart_rate', 'spo2', 'systolic_bp', 'diastolic_bp', 'temperature', 'resp_rate', 'glucose', 'motion_index', 'bed_status']

const HOURS_24 = 24 * 3600000
const HOURS_48 = 48 * 3600000

const METRIC_LABELS: Record<string, string> = {
  heart_rate: '心率', spo2: '血氧', systolic_bp: '收缩压', diastolic_bp: '舒张压',
  temperature: '体温', resp_rate: '呼吸率', glucose: '血糖', motion_index: '体动', bed_status: '离床',
}
const METRIC_COLORS: Record<string, string> = {
  heart_rate: 'red', spo2: 'blue', systolic_bp: 'orange', diastolic_bp: 'yellow',
  temperature: 'green', resp_rate: 'cyan', glucose: 'pink', motion_index: 'grape', bed_status: 'gray',
}

export function HealthTimeline() {
  const { id } = (useParams as any)({ from: '/_auth/patients/$id' })
  const [hours, setHours] = useState('24')
  const from = Date.now() - (hours === '48' ? HOURS_48 : HOURS_24)

  const tsBatch = trpc.data.timeseriesBatch.useQuery(
    { patientId: id!, metrics: METRICS, from, to: Date.now() },
    { enabled: !!id, refetchInterval: 30000 },
  )

  const alerts = trpc.alert.list.useQuery(
    { patientId: id!, from, pageSize: 100 },
    { enabled: !!id, refetchInterval: 30000 },
  )

  const timeline = useMemo(() => {
    const data = tsBatch.data ?? {}
    const allEvents: { metric: string; time: number; value: number | null; isAlert: boolean; severity?: string | null }[] = []

    for (const [metric, points] of Object.entries(data)) {
      for (const p of points as any[]) {
        allEvents.push({ metric, time: p.recordedAt, value: p.value, isAlert: false })
      }
    }

    for (const a of (alerts.data ?? [])) {
      if (a.recordedAt > from) {
        allEvents.push({ metric: a.metric, time: a.recordedAt, value: a.value, isAlert: true, severity: a.severity as string | undefined })
      }
    }

    return allEvents.sort((a, b) => a.time - b.time)
  }, [tsBatch.data, alerts.data, from])

  const timeRange = Date.now() - from

  return (
    <Paper p="md" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Text fw={600}>健康时间轴</Text>
        <SegmentedControl color="matchaGreen" size="xs" value={hours} onChange={(v) => setHours(v as string)}
          data={[{ label: '24h', value: '24' }, { label: '48h', value: '48' }]} />
      </Group>

      <div style={{ maxHeight: 500, overflowY: 'auto', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {METRICS.map((metric, rowIdx) => {
            const events = timeline.filter((e) => e.metric === metric)
            if (events.length === 0) return null

            return (
              <div key={metric} style={{ display: 'flex', alignItems: 'center', height: 32, gap: 4 }}>
                <Badge size="xs" color={METRIC_COLORS[metric]} variant="light" style={{ width: 50, flexShrink: 0, textAlign: 'center' }}>
                  {METRIC_LABELS[metric] || metric}
                </Badge>

                <div style={{ flex: 1, height: 20, position: 'relative', background: 'var(--mantine-color-gray-2)', borderRadius: 4, overflow: 'hidden' }}>
                  {events.map((e, idx) => {
                    const left = ((e.time - from) / timeRange) * 100
                    return (
                      <div key={idx}
                        title={`${e.metric}: ${e.value} at ${new Date(e.time).toLocaleTimeString('zh-CN')}`}
                        style={{
                          position: 'absolute', left: `${left}%`, top: 2, width: e.isAlert ? 6 : 3, height: 16,
                          borderRadius: e.isAlert ? 3 : '50%',
                          background: e.isAlert
                            ? ((e.severity as string) === 'critical' ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-orange-6)')
                            : `var(--mantine-color-${METRIC_COLORS[metric]}-6)`,
                          opacity: 0.8, cursor: 'pointer',
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Paper>
  )
}