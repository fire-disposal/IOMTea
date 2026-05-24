import { createFileRoute } from '@tanstack/react-router'
import {
  Container, Title, Paper, Group, Button, Select, MultiSelect,
  Badge, Text, Grid, Stack, Table, NumberInput, ActionIcon,
  SegmentedControl, Divider, Box, Modal,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState, useEffect, useRef } from 'react'
import { IconPlayerPlay, IconPlayerStop, IconRefresh, IconChartBar } from '@tabler/icons-react'
import { trpc } from '../trpc'
import { SimTimeline } from '../components/sim/SimTimeline'

const PROFILES = [
  { value: 'elderly-cardiac', label: '老年心脏' },
  { value: 'diabetes', label: '糖尿病' },
  { value: 'post-surgery', label: '术后恢复' },
  { value: 'copd-respiratory', label: 'COPD呼吸' },
  { value: 'maternity', label: '产科' },
]

const METRIC_LABELS: Record<string, string> = {
  heart_rate: '心率', resp_rate: '呼吸率', spo2: '血氧',
  temperature: '体温', systolic_bp: '收缩压', diastolic_bp: '舒张压',
  glucose: '血糖', posture: '姿态', bed_status: '卧床', motion_index: '活动指数',
}

function SimulationPage() {
  const [selectedPatients, setSelectedPatients] = useState<string[]>([])
  const [profile, setProfile] = useState<string>('elderly-cardiac')
  const [overrides, setOverrides] = useState<Record<string, { intervalMin: number; intervalMax: number; jitter: number }>>({})
  const [detailPatient, setDetailPatient] = useState<any>(null)
  const [timelineMinutes, setTimelineMinutes] = useState(10)
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const { data: patientList } = trpc.patient.list.useQuery({ page: 1, pageSize: 200 })
  const { data: simStatus, refetch: refreshStatus } = trpc.sim.status.useQuery()
  const { data: profileConfig } = trpc.sim.profileConfig.useQuery(profile)

  const start = trpc.sim.start.useMutation({
    onSuccess: (d) => { refreshStatus(); notifications.show({ title: '已启动', message: `${d.count} 位患者`, color: 'green' }) },
  })
  const stop = trpc.sim.stop.useMutation({
    onSuccess: () => { refreshStatus(); notifications.show({ title: '已停止', message: '', color: 'orange' }) },
  })
  const setSpeed = trpc.sim.setSpeed.useMutation()

  useEffect(() => {
    pollRef.current = setInterval(() => refreshStatus(), 2000)
    return () => clearInterval(pollRef.current)
  }, [refreshStatus])

  useEffect(() => {
    if (profileConfig) {
      const init: Record<string, any> = {}
      for (const m of profileConfig) {
        init[m.metric] = { intervalMin: m.interval.min, intervalMax: m.interval.max, jitter: m.jitter }
      }
      setOverrides(init)
    }
  }, [profile, profileConfig])

  const updateMetric = (metric: string, field: string, value: number) => {
    setOverrides((prev) => ({
      ...prev,
      [metric]: { ...prev[metric], [field]: value },
    }))
  }

  const resetToDefault = () => {
    if (!profileConfig) return
    const init: Record<string, any> = {}
    for (const m of profileConfig) init[m.metric] = { intervalMin: m.interval.min, intervalMax: m.interval.max, jitter: m.jitter }
    setOverrides(init)
  }

  const hasCustomOverrides = profileConfig?.some((m: any) => {
    const ov = overrides[m.metric]
    return ov && (ov.intervalMin !== m.interval.min || ov.intervalMax !== m.interval.max || ov.jitter !== m.jitter)
  })

  const running = (simStatus ?? []).filter((s: any) => s.running)

  const patientOptions = (patientList ?? []).map((p: any) => {
    const isRunning = running.some((s: any) => s.patientId === p.id)
    return { value: p.id, label: isRunning ? `● ${p.name}` : p.name }
  })

  const handleStart = () => {
    if (selectedPatients.length === 0) return
    start.mutate({
      patientIds: selectedPatients,
      profile,
      overrides: hasCustomOverrides ? overrides : undefined,
    })
  }

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md">模拟数据工厂</Title>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Paper p="md" withBorder>
            <Text fw={600} mb="md">配置与启动</Text>

            <MultiSelect
              label="选择患者"
              data={patientOptions}
              value={selectedPatients}
              onChange={setSelectedPatients}
              placeholder="搜索患者..."
              searchable mb="sm"
            />

            <Select
              label="患者画像"
              data={PROFILES}
              value={profile}
              onChange={(v) => { setProfile(v!); setOverrides({}) }}
              mb="sm"
            />

            <Button
              fullWidth
              leftSection={<IconPlayerPlay size={18} />}
              color="green"
              onClick={handleStart}
              loading={start.isPending}
              disabled={selectedPatients.length === 0}
              mb="md"
            >
              启动 {selectedPatients.length || ''} 位患者
            </Button>

            <Divider mb="md" />

            <Group justify="space-between" mb="xs">
              <Text fw={600}>指标编排</Text>
              <Button size="compact-sm" variant="subtle" onClick={resetToDefault}>重置默认</Button>
            </Group>

            {profileConfig && profileConfig.length > 0 && (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>指标</Table.Th>
                    <Table.Th>最小间隔</Table.Th>
                    <Table.Th>最大间隔</Table.Th>
                    <Table.Th>抖动</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {profileConfig.map((m: any) => (
                    <Table.Tr key={m.metric}>
                      <Table.Td>{METRIC_LABELS[m.metric] ?? m.metric}</Table.Td>
                      <Table.Td>
                        <NumberInput size="xs" min={100} max={600000}
                          step={m.interval.min < 10000 ? 1000 : 10000}
                          value={overrides[m.metric]?.intervalMin ?? m.interval.min}
                          onChange={(v) => updateMetric(m.metric, 'intervalMin', Number(v))}
                          hideControls w={80} />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput size="xs" min={100} max={600000}
                          step={m.interval.max < 10000 ? 1000 : 10000}
                          value={overrides[m.metric]?.intervalMax ?? m.interval.max}
                          onChange={(v) => updateMetric(m.metric, 'intervalMax', Number(v))}
                          hideControls w={80} />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput size="xs" min={0} max={1} step={0.1} decimalScale={2}
                          value={overrides[m.metric]?.jitter ?? m.jitter}
                          onChange={(v) => updateMetric(m.metric, 'jitter', Number(v))}
                          hideControls w={60} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Paper p="md" withBorder mb="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>运行中的模拟</Text>
              <Group gap="xs">
                <Badge size="lg" variant="light" color={running.length > 0 ? 'green' : 'gray'}>
                  {running.length}
                </Badge>
                <ActionIcon variant="subtle" onClick={() => refreshStatus()}><IconRefresh size={16} /></ActionIcon>
              </Group>
            </Group>

            {running.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">暂无运行中的模拟，在左侧配置并启动</Text>
            )}

            {running.map((s: any) => (
              <Paper key={s.patientId} p="sm" withBorder mb="sm"
                style={{ cursor: 'pointer' }}
                onClick={() => { setDetailPatient(s); setTimelineMinutes(10) }}>
                <Group justify="space-between" mb="xs">
                  <Group gap="sm">
                    <Text fw={600}>{s.patientName}</Text>
                    <Badge size="sm" variant="light">{PROFILES.find((p) => p.value === s.profile)?.label ?? s.profile}</Badge>
                  </Group>
                  <Group gap="xs">
                    <ActionIcon variant="light" color="blue" size="sm"
                      onClick={(e) => { e.stopPropagation(); setDetailPatient(s); setTimelineMinutes(10) }}>
                      <IconChartBar size={14} />
                    </ActionIcon>
                    <Button size="compact-sm" color="red" variant="light"
                      leftSection={<IconPlayerStop size={14} />}
                      onClick={(e) => { e.stopPropagation(); stop.mutate({ patientIds: [s.patientId] }) }}
                      loading={stop.isPending}>停止</Button>
                  </Group>
                </Group>
                <Grid>
                  {(Object.entries(s.lastValues ?? {}) as [string, number][]).slice(0, 8).map(([k, v]) => (
                    <Grid.Col key={k} span={{ base: 6, sm: 4, md: 3 }}>
                      <Text size="xs" c="dimmed">{METRIC_LABELS[k] ?? k}</Text>
                      <Text size="sm" fw={600}>{typeof v === 'number' ? v.toFixed(1) : String(v)}</Text>
                    </Grid.Col>
                  ))}
                </Grid>
                <Text size="xs" c="dimmed" mt="xs">tick: {s.tickCount}</Text>
              </Paper>
            ))}
          </Paper>

          <Paper p="md" withBorder>
            <Text fw={600} mb="sm">全局速度</Text>
            <SegmentedControl
              data={[
                { value: '0.5', label: '0.5x' },
                { value: '1', label: '1x' },
                { value: '2', label: '2x' },
                { value: '5', label: '5x' },
                { value: '10', label: '10x' },
              ]}
              onChange={(v) => setSpeed.mutate({ speed: Number(v) })}
            />
          </Paper>
        </Grid.Col>
      </Grid>

      <Modal
        opened={!!detailPatient}
        onClose={() => setDetailPatient(null)}
        title={detailPatient?.patientName ? `${detailPatient.patientName} — 数据时间线` : '数据时间线'}
        size="xl"
      >
        {detailPatient && (
          <Stack>
            <Group>
              <Badge variant="light">{PROFILES.find((p) => p.value === detailPatient.profile)?.label}</Badge>
              <Text size="xs" c="dimmed">tick: {detailPatient.tickCount}</Text>
            </Group>
            <SimTimeline
              patientId={detailPatient.patientId}
              minutes={timelineMinutes}
              onMinutesChange={setTimelineMinutes}
            />
          </Stack>
        )}
      </Modal>
    </Container>
  )
}

export const Route = createFileRoute('/_auth/simulation')({
  component: SimulationPage,
})
