import { Paper, Text } from '@mantine/core'
import { useMemo } from 'react'
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface TimelinePoint {
  time: number
  metric: string
  value: number
  displayName: string
}

interface Props {
  data: TimelinePoint[]
  height?: number
}

const METRIC_COLORS: Record<string, string> = {
  heart_rate: '#e03131',
  spo2: '#1971c2',
  temperature: '#f08c00',
  systolic_bp: '#e03131',
  diastolic_bp: '#ff8787',
  glucose: '#2f9e44',
  respiratory_rate: '#7950f2',
  motion_index: '#868e96',
}

export function GanttTimeline({ data, height = 300 }: Props) {
  const metrics = useMemo(() => [...new Set(data.map((d) => d.metric))], [data])

  const buckets = useMemo(() => {
    if (data.length === 0) return []
    const times = data.map((d) => d.time).sort((a, b) => a - b)
    const min = times[0]
    const max = times[times.length - 1]
    const span = max - min || 3600000
    const bucketCount = Math.min(24, Math.ceil(span / 3600000))
    const bucketMs = span / bucketCount

    return Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = min + i * bucketMs
      const bucketEnd = bucketStart + bucketMs
      const bucketData: Record<string, unknown> = {
        time: new Date(bucketStart).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        _ts: bucketStart,
      }
      for (const m of metrics) {
        const inBucket = data.filter(
          (d) => d.metric === m && d.time >= bucketStart && d.time < bucketEnd,
        )
        if (inBucket.length > 0) {
          bucketData[m] = inBucket.reduce((s, d) => s + d.value, 0) / inBucket.length
        }
      }
      return bucketData
    })
  }, [data, metrics])

  const displayNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const d of data) {
      if (!map[d.metric]) map[d.metric] = d.displayName || d.metric
    }
    return map
  }, [data])

  if (data.length === 0) {
    return (
      <Paper p="md" withBorder>
        <Text c="dimmed" ta="center">
          暂无数据
        </Text>
      </Paper>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={buckets} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
        <YAxis tick={false} width={30} />
        <Tooltip
          formatter={
            ((value: unknown, name: string) => {
              const v = Number(value)
              return [isNaN(v) ? '-' : v.toFixed(1), displayNameMap[name] || name]
            }) as any
          }
          labelFormatter={(label) => `时间: ${label}`}
        />
        <Legend
          formatter={(name: string) => displayNameMap[name] || name}
          wrapperStyle={{ fontSize: 12 }}
        />
        {metrics.map((m, i) => (
          <Bar
            key={m}
            dataKey={m}
            stackId="timeline"
            fill={METRIC_COLORS[m] || `hsl(${i * 72}, 60%, 50%)`}
            radius={[2, 2, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
