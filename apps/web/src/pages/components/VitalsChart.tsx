import { ActionIcon, Button, Group, Paper, SegmentedControl, Text } from '@mantine/core'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface ChartDataPoint {
  ts: number
  hr?: number
  spo2?: number
  systolic_bp?: number
  temp?: number
}

interface VitalsChartProps {
  data: ChartDataPoint[]
  timeRange: string
  onTimeRangeChange: (v: string) => void
  visible: boolean
  onToggle: () => void
}

export function VitalsChart({ data, timeRange, onTimeRangeChange, visible, onToggle }: VitalsChartProps) {
  if (!visible) {
    return (
      <Button
        variant="light"
        size="xs"
        leftSection={<IconChevronDown size={14} />}
        onClick={onToggle}
        style={{ alignSelf: 'flex-start' }}
      >
        显示生命体征趋势
      </Button>
    )
  }

  return (
    <Paper p="md" radius="md" withBorder style={{ flex: '0 0 auto' }}>
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <Text fw={600}>生命体征趋势</Text>
          <ActionIcon variant="subtle" size="sm" onClick={onToggle} title="收起">
            <IconChevronUp size={16} />
          </ActionIcon>
        </Group>
        <SegmentedControl
          size="xs"
          value={timeRange}
          onChange={(v: string) => onTimeRangeChange(v)}
          data={[
            { label: '1h', value: '1h' },
            { label: '6h', value: '6h' },
            { label: '24h', value: '24h' },
            { label: '7d', value: '7d' },
          ]}
        />
      </Group>

      <div style={{ height: 260 }}>
        {data.length === 0 ? (
          <Text c="dimmed" size="sm" ta="center" mt="xl">暂无数据</Text>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={['auto', 'auto']}
                tickFormatter={(ts) =>
                  new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                }
                tick={{ fontSize: 11 }}
              />
              <YAxis yAxisId="vitals" domain={[40, 200]} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="pct" orientation="right" domain={[35, 100]} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(ts) => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} />
              <Legend />
              <Line yAxisId="vitals" type="monotone" dataKey="hr" stroke="#e03131" strokeWidth={2} dot={false} name="心率 (bpm)" connectNulls />
              <Line yAxisId="vitals" type="monotone" dataKey="systolic_bp" stroke="#f08c00" strokeWidth={2} dot={false} name="收缩压 (mmHg)" connectNulls />
              <Line yAxisId="pct" type="monotone" dataKey="spo2" stroke="#1971c2" strokeWidth={2} dot={false} name="血氧 (%)" connectNulls />
              <Line yAxisId="pct" type="monotone" dataKey="temp" stroke="#2f9e44" strokeWidth={1.5} dot={false} name="体温 (°C)" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Paper>
  )
}