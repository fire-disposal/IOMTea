import { Paper, Text, Group, SegmentedControl, Badge, Box, Tooltip } from '@mantine/core'
import { trpc } from '../../trpc'
import { useMemo } from 'react'

const METRIC_COLORS: Record<string, string> = {
  heart_rate: '#e53e3e', resp_rate: '#38b2ac', spo2: '#3182ce',
  temperature: '#ed8936', systolic_bp: '#e53e3e', diastolic_bp: '#e53e3e',
  glucose: '#d69e2e', posture: '#805ad5', bed_status: '#38a169',
  motion_index: '#718096',
}

const METRIC_LABELS: Record<string, string> = {
  heart_rate: '心率', resp_rate: '呼吸', spo2: '血氧',
  temperature: '体温', systolic_bp: '收缩压', diastolic_bp: '舒张压',
  glucose: '血糖', posture: '姿态', bed_status: '卧床', motion_index: '活动',
}

interface SimTimelineProps {
  patientId: string
  minutes: number
  onMinutesChange: (m: number) => void
}

export function SimTimeline({ patientId, minutes, onMinutesChange }: SimTimelineProps) {
  const { data } = trpc.sim.events.useQuery({ patientId, minutes }, { refetchInterval: 3000 })

  const { lanes, timeRange } = useMemo(() => {
    const events = data ?? []
    const now = Date.now()
    const start = now - minutes * 60 * 1000
    const totalMs = now - start

    const byMetric = new Map<string, { time: number; value: number | null }[]>()
    for (const e of events) {
      const m = e.metric ?? 'unknown'
      if (!byMetric.has(m)) byMetric.set(m, [])
      byMetric.get(m)!.push({ time: e.recordedAt, value: e.value as number | null })
    }

    const sorted = Array.from(byMetric.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    return {
      lanes: sorted,
      timeRange: { start, totalMs, now },
    }
  }, [data, minutes])

  const formatTime = (t: number) => {
    const d = new Date(t)
    return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  const posX = (time: number) => `${((time - timeRange.start) / timeRange.totalMs) * 100}%`

  return (
    <Box>
      <Group justify="space-between" mb="sm">
        <Text size="sm" fw={600}>事件时间线</Text>
        <SegmentedControl
          size="xs"
          data={[
            { value: '1', label: '1m' },
            { value: '5', label: '5m' },
            { value: '10', label: '10m' },
            { value: '30', label: '30m' },
          ]}
          value={String(minutes)}
          onChange={(v) => onMinutesChange(Number(v))}
        />
      </Group>

      <Paper withBorder p="xs" style={{ overflowX: 'auto' }}>
        <Box style={{ minWidth: '100%', position: 'relative' }}>
          {/* Time axis */}
          <Box h={20} style={{ position: 'relative', borderBottom: '1px solid #eee' }}>
            {Array.from({ length: minutes <= 5 ? minutes + 1 : 6 }, (_, i) => {
              const t = timeRange.now - ((minutes * 60 * 1000) / (minutes <= 5 ? minutes : 5)) * i
              return (
                <Text key={i} size="xs" c="dimmed"
                  style={{ position: 'absolute', left: posX(t), transform: 'translateX(-50%)', bottom: 2 }}>
                  {formatTime(t)}
                </Text>
              )
            })}
          </Box>

          {/* Metric lanes */}
          {lanes.map(([metric, points], li) => (
            <Box key={metric}
              h={28}
              style={{
                position: 'relative',
                background: li % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <Badge
                size="xs"
                variant="light"
                color={
                  METRIC_COLORS[metric] === '#e53e3e' ? 'red' :
                  METRIC_COLORS[metric] === '#3182ce' ? 'blue' :
                  METRIC_COLORS[metric] === '#38b2ac' ? 'teal' :
                  METRIC_COLORS[metric] === '#ed8936' ? 'orange' :
                  METRIC_COLORS[metric] === '#d69e2e' ? 'yellow' : 'gray'
                }
                style={{ position: 'absolute', left: 4, top: 4, zIndex: 1, fontSize: 10 }}
              >
                {METRIC_LABELS[metric] ?? metric}
              </Badge>

              {/* Expected interval bars */}
              <Box
                style={{
                  position: 'absolute',
                  left: posX(timeRange.now - (points[0]?.time ? timeRange.now - points[0].time : timeRange.totalMs)),
                  right: 0,
                  top: 12,
                  height: 4,
                  background: METRIC_COLORS[metric] ? `${METRIC_COLORS[metric]}18` : '#eee',
                  borderRadius: 2,
                }}
              />

              {/* Event dots */}
              {points.slice(0, 50).map((p, i) => {
                const x = posX(p.time)
                const isTooOld = parseFloat(x) < 0
                if (isTooOld) return null
                return (
                  <Tooltip key={i} label={`${p.value?.toFixed(1) ?? '-'}`}>
                    <Box
                      style={{
                        position: 'absolute',
                        left: x,
                        top: 8,
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: METRIC_COLORS[metric] ?? '#999',
                        transform: 'translateX(-50%)',
                        cursor: 'pointer',
                      }}
                    />
                  </Tooltip>
                )
              })}
            </Box>
          ))}
        </Box>
      </Paper>
      <Text size="xs" c="dimmed" mt={4} ta="right">{data?.length ?? 0} 条事件</Text>
    </Box>
  )
}
