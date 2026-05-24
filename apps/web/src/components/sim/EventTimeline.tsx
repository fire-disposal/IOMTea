import { Paper, Text, Group, SegmentedControl, Badge, Box, Tooltip, Card, Stack, ActionIcon, Modal, Code, Switch, ScrollArea } from '@mantine/core'
import { trpc } from '../../trpc'
import { useMemo, useState, useRef } from 'react'
import { IconZoomIn, IconZoomOut, IconEye } from '@tabler/icons-react'

const METRIC_LABELS: Record<string, string> = {
  heart_rate: '心率', resp_rate: '呼吸', spo2: '血氧',
  temperature: '体温', systolic_bp: '收缩压', diastolic_bp: '舒张压',
  glucose: '血糖', posture: '姿态', bed_status: '卧床', motion_index: '活动',
}
const METRIC_UNITS: Record<string, string> = {
  heart_rate: 'bpm', resp_rate: 'rpm', spo2: '%', temperature: '°C',
  systolic_bp: 'mmHg', diastolic_bp: 'mmHg', glucose: 'mmol/L',
}
const METRIC_HEX: Record<string, string> = {
  heart_rate: '#e53e3e', resp_rate: '#38b2ac', spo2: '#3182ce',
  temperature: '#ed8936', systolic_bp: '#e53e3e', diastolic_bp: '#e53e3e',
  glucose: '#d69e2e', posture: '#805ad5', bed_status: '#38a169', motion_index: '#718096',
}

interface EventTimelineProps {
  patientId: string
  minutes: number
  onMinutesChange: (m: number) => void
  title?: string
}

export function EventTimeline({ patientId, minutes, onMinutesChange, title }: EventTimelineProps) {
  const { data, isLoading } = trpc.sim.events.useQuery({ patientId, minutes }, { refetchInterval: 5000 })
  const [hiddenMetrics, setHiddenMetrics] = useState<Set<string>>(new Set())
  const [detailRecord, setDetailRecord] = useState<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { lanes, timeRange, allMetrics } = useMemo(() => {
    const events = data ?? []
    const now = Date.now()
    const start = now - minutes * 60 * 1000
    const totalMs = now - start

    const byMetric = new Map<string, any[]>()
    for (const e of events) {
      const m = e.metric ?? 'unknown'
      if (!byMetric.has(m)) byMetric.set(m, [])
      byMetric.get(m)!.push(e)
    }

    const keys = Array.from(byMetric.keys()).sort()
    return { lanes: keys.map((k) => [k, byMetric.get(k)!] as const), timeRange: { start, totalMs, now }, allMetrics: keys }
  }, [data, minutes])

  const toggleMetric = (m: string) => {
    setHiddenMetrics((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m); else next.add(m)
      return next
    })
  }
  const posX = (time: number) => `${((time - timeRange.start) / timeRange.totalMs) * 100}%`
  const visibleLanes = lanes.filter(([m]) => !hiddenMetrics.has(m))

  const formatTimeFull = (t: number) => {
    const d = new Date(t)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  const timeTicks = useMemo(() => {
    const ticks = []
    const step = minutes <= 5 ? 60 : minutes <= 15 ? 120 : minutes <= 30 ? 300 : 600
    const totalSecs = minutes * 60
    for (let s = 0; s <= totalSecs; s += step) {
      const t = timeRange.now - s * 1000
      ticks.push({ time: t, label: formatTimeFull(t) })
    }
    return ticks
  }, [minutes, timeRange.now])

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Group gap="xs">
          {title && <Text size="sm" fw={600}>{title}</Text>}
          <Badge size="sm" variant="light">{data?.length ?? 0} 条</Badge>
        </Group>
        <Group gap="xs">
          <SegmentedControl size="xs"
            data={[{ value: '1', label: '1m' }, { value: '5', label: '5m' }, { value: '15', label: '15m' }, { value: '30', label: '30m' }, { value: '60', label: '1h' }]}
            value={String(minutes)} onChange={(v) => onMinutesChange(Number(v))} />
        </Group>
      </Group>

      <Group gap={4}>
        {allMetrics.map((m) => (
          <Badge key={m} size="xs" variant={hiddenMetrics.has(m) ? 'outline' : 'filled'}
            color={hiddenMetrics.has(m) ? 'gray' : undefined}
            style={{ cursor: 'pointer', background: hiddenMetrics.has(m) ? undefined : METRIC_HEX[m] ?? '#666' }}
            onClick={() => toggleMetric(m)}>
            {METRIC_LABELS[m] ?? m}
          </Badge>
        ))}
      </Group>

      {isLoading && <Text c="dimmed" size="sm" ta="center" py="md">加载中...</Text>}

      {!isLoading && visibleLanes.length === 0 && (
        <Text c="dimmed" size="sm" ta="center" py="md">暂无数据或已全部隐藏</Text>
      )}

      {!isLoading && visibleLanes.length > 0 && (
        <ScrollArea viewportRef={scrollRef} style={{ overflowX: 'auto' }} offsetScrollbars>
          <Box style={{ minWidth: Math.max(600, minutes * 12), position: 'relative' }}>
            <Box h={22} style={{ position: 'relative', borderBottom: '1px solid #e0e0e0' }}>
              {timeTicks.map((t, i) => (
                <Text key={i} size="xs" c="dimmed"
                  style={{ position: 'absolute', left: posX(t.time), transform: 'translateX(-50%)', bottom: 2, whiteSpace: 'nowrap' }}>
                  {t.label}
                </Text>
              ))}
            </Box>

            {visibleLanes.map(([metric, points], li) => {
              const hex = METRIC_HEX[metric] ?? '#999'
              const sorted = (points as any[]).sort((a, b) => a.recordedAt - b.recordedAt)
              return (
                <Card key={metric} p={0} radius={0} withBorder={false}
                  style={{ borderBottom: '1px solid #f5f5f5', background: li % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                  <Box h={36} style={{ position: 'relative' }}>
                    <Badge size="xs" variant="light" color={hex === '#e53e3e' ? 'red' : hex === '#3182ce' ? 'blue' : hex === '#38b2ac' ? 'teal' : 'gray'}
                      style={{ position: 'absolute', left: 4, top: 4, zIndex: 1 }}>
                      {METRIC_LABELS[metric] ?? metric}
                    </Badge>

                    {sorted.slice(0, 80).map((p: any, i: number) => {
                      const x = parseFloat(posX(p.recordedAt))
                      if (x < 0 || x > 100) return null
                      return (
                        <Tooltip key={i}
                          label={
                            <Box>
                              <Text size="xs">{METRIC_LABELS[metric] ?? metric}: {p.value?.toFixed(1) ?? '-'}{METRIC_UNITS[metric] ? ` ${METRIC_UNITS[metric]}` : ''}</Text>
                              <Text size="xs" c="dimmed">{new Date(p.recordedAt).toLocaleTimeString()}</Text>
                            </Box>
                          }>
                          <Box
                            style={{
                              position: 'absolute',
                              left: `${x}%`, top: 8,
                              width: 6, height: 6,
                              borderRadius: '50%',
                              background: hex,
                              transform: 'translateX(-50%)',
                              cursor: 'pointer',
                              zIndex: 2,
                            }}
                            onClick={(e) => { e.stopPropagation(); setDetailRecord(p) }}
                          />
                        </Tooltip>
                      )
                    })}

                    <Box style={{ position: 'absolute', left: 0, right: 0, top: 20, height: 2, background: `${hex}10`, borderRadius: 1 }} />
                  </Box>
                </Card>
              )
            })}
          </Box>
        </ScrollArea>
      )}

      <Modal opened={!!detailRecord} onClose={() => setDetailRecord(null)} title="事件详情" size="sm">
        {detailRecord && (
          <Stack gap="xs">
            <Group><Text size="sm" fw={500}>指标:</Text><Badge>{METRIC_LABELS[detailRecord.metric] ?? detailRecord.metric}</Badge></Group>
            <Group><Text size="sm" fw={500}>值:</Text><Text>{detailRecord.value?.toFixed(2) ?? '-'}{METRIC_UNITS[detailRecord.metric] ? ` ${METRIC_UNITS[detailRecord.metric]}` : ''}</Text></Group>
            <Group><Text size="sm" fw={500}>时间:</Text><Text size="sm">{new Date(detailRecord.recordedAt).toLocaleString()}</Text></Group>
            <Text size="sm" fw={500}>原始记录:</Text>
            <Code block style={{ fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
              {JSON.stringify(detailRecord, null, 2)}
            </Code>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
