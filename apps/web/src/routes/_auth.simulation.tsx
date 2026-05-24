import { createFileRoute } from '@tanstack/react-router'
import {
  Container, Title, Paper, Group, Button, Select, MultiSelect, Badge, Text,
  Grid, Stack, Table, NumberInput, ActionIcon, SegmentedControl, Divider,
  Box, Modal, Switch, Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState, useEffect, useRef } from 'react'
import { IconPlayerPlay, IconPlayerStop, IconRefresh, IconChartBar, IconPlus, IconTrash } from '@tabler/icons-react'
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
  const { data: patientList } = trpc.patient.list.useQuery({ page: 1, pageSize: 200 })
  const { data: simulations, refetch: refreshSims } = trpc.sim.simulations.useQuery()
  const { data: simStatus, refetch: refreshStatus } = trpc.sim.status.useQuery()
  const { data: profileConfig } = trpc.sim.profileConfig.useQuery('elderly-cardiac')
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const [detailPatient, setDetailPatient] = useState<any>(null)
  const [timelineMinutes, setTimelineMinutes] = useState(10)

  const createSim = trpc.sim.create.useMutation({ onSuccess: () => { refreshSims(); notifications.show({ title: '模拟已创建', message: '', color: 'green' }) } })
  const toggleSim = trpc.sim.toggle.useMutation({ onSuccess: () => refreshSims() })
  const deleteSim = trpc.sim.delete.useMutation({ onSuccess: () => refreshSims() })
  const toggleMetric = trpc.sim.toggleMetric.useMutation({ onSuccess: () => refreshSims() })
  const addPatients = trpc.sim.addPatients.useMutation({ onSuccess: () => { refreshSims(); refreshStatus() } })
  const removePatients = trpc.sim.removePatients.useMutation({ onSuccess: () => { refreshSims(); refreshStatus() } })
  const setSpeed = trpc.sim.setSpeed.useMutation()

  useEffect(() => { pollRef.current = setInterval(() => { refreshSims(); refreshStatus() }, 2000); return () => clearInterval(pollRef.current) }, [refreshSims, refreshStatus])

  const [creating, setCreating] = useState(false)
  const [newProfile, setNewProfile] = useState('elderly-cardiac')
  const [addPatientSimId, setAddPatientSimId] = useState<string | null>(null)
  const [addPatientIds, setAddPatientIds] = useState<string[]>([])

  const handleCreate = () => {
    if (!creating) { setCreating(true); return }
    createSim.mutate({ profile: newProfile })
    setCreating(false)
  }

  const patientOptions = (patientList ?? []).map((p: any) => {
    const isRunning = simStatus?.some((s: any) => s.patientId === p.id)
    return { value: p.id, label: isRunning ? `● ${p.name}` : p.name }
  })

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md">模拟数据工厂</Title>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper p="md" withBorder mb="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>模拟配置</Text>
              <Button size="compact-sm" variant="light" onClick={handleCreate}
                loading={createSim.isPending} color={creating ? 'green' : undefined}
                leftSection={<IconPlus size={14} />}>
                {creating ? '确认创建' : '新建模拟'}
              </Button>
            </Group>
            {creating && (
              <Select mb="sm" label="患者画像" data={PROFILES} value={newProfile} onChange={(v) => setNewProfile(v!)} />
            )}
            {!creating && (!simulations || simulations.length === 0) && (
              <Text c="dimmed" size="sm" ta="center" py="md">点击"新建模拟"创建第一个配置</Text>
            )}
          </Paper>

          {(simulations ?? []).map((sim: any) => (
            <Paper key={sim.id} p="sm" withBorder mb="sm">
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Switch size="sm" checked={sim.running}
                    onChange={(e) => toggleSim.mutate({ id: sim.id, running: e.currentTarget.checked })} />
                  <Badge variant="light" size="sm">{PROFILES.find((p) => p.value === sim.profileName)?.label}</Badge>
                  <Text size="xs" c="dimmed">{sim.patientCount} 位患者</Text>
                </Group>
                <ActionIcon variant="subtle" color="red" size="sm" onClick={() => deleteSim.mutate({ id: sim.id })}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>

              <Text size="xs" fw={500} mb={4}>指标开关</Text>
              <Group gap={4} mb="xs">
                {sim.metrics.map((m: any) => (
                  <Tooltip key={m.name} label={METRIC_LABELS[m.name] ?? m.name}>
                    <Badge size="xs" variant={m.enabled ? 'filled' : 'outline'}
                      color={m.enabled ? 'teal' : 'gray'}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleMetric.mutate({ id: sim.id, metric: m.name, enabled: !m.enabled })}>
                      {METRIC_LABELS[m.name] ?? m.name}
                    </Badge>
                  </Tooltip>
                ))}
              </Group>

              <Group mt="xs">
                {!addPatientSimId || addPatientSimId !== sim.id ? (
                  <Button size="compact-xs" variant="light" color="blue"
                    onClick={() => { setAddPatientSimId(sim.id); setAddPatientIds([]) }}>
                    管理患者
                  </Button>
                ) : (
                  <Group>
                    <MultiSelect size="xs" data={patientOptions} value={addPatientIds}
                      onChange={setAddPatientIds} placeholder="搜索患者"
                      searchable w={200} />
                    <Button size="compact-xs" onClick={() => { addPatients.mutate({ id: sim.id, patientIds: addPatientIds }); setAddPatientSimId(null) }}
                      disabled={addPatientIds.length === 0}>添加</Button>
                    <Button size="compact-xs" variant="subtle" onClick={() => setAddPatientSimId(null)}>取消</Button>
                  </Group>
                )}
              </Group>
            </Paper>
          ))}
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper p="md" withBorder mb="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>运行中的患者</Text>
              <Group gap="xs">
                <Badge size="lg" variant="light" color={(simStatus?.length ?? 0) > 0 ? 'green' : 'gray'}>
                  {simStatus?.length ?? 0}
                </Badge>
                <ActionIcon variant="subtle" onClick={() => { refreshSims(); refreshStatus() }}><IconRefresh size={16} /></ActionIcon>
              </Group>
            </Group>
            {(simStatus ?? []).length === 0 && <Text c="dimmed" ta="center" py="xl">暂无运行中的患者数据</Text>}

            {(simStatus ?? []).map((s: any) => (
              <Paper key={s.patientId} p="sm" withBorder mb="sm" style={{ cursor: 'pointer' }}
                onClick={() => { setDetailPatient(s); setTimelineMinutes(10) }}>
                <Group justify="space-between" mb="xs">
                  <Group gap="sm">
                    <Text fw={600}>{s.patientName}</Text>
                    <Badge size="sm" variant="light">{PROFILES.find((p) => p.value === s.profile)?.label}</Badge>
                  </Group>
                  <ActionIcon variant="light" color="blue" size="sm">
                    <IconChartBar size={14} />
                  </ActionIcon>
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
                { value: '0.5', label: '0.5x' }, { value: '1', label: '1x' },
                { value: '2', label: '2x' }, { value: '5', label: '5x' }, { value: '10', label: '10x' },
              ]}
              onChange={(v) => setSpeed.mutate({ speed: Number(v) })}
            />
          </Paper>
        </Grid.Col>
      </Grid>

      <Modal opened={!!detailPatient} onClose={() => setDetailPatient(null)}
        title={detailPatient?.patientName ? `${detailPatient.patientName} — 数据时间线` : '数据时间线'} size="xl">
        {detailPatient && (
          <Stack>
            <Group>
              <Badge variant="light">{PROFILES.find((p) => p.value === detailPatient.profile)?.label}</Badge>
              <Text size="xs" c="dimmed">tick: {detailPatient.tickCount}</Text>
            </Group>
            <SimTimeline patientId={detailPatient.patientId} minutes={timelineMinutes} onMinutesChange={setTimelineMinutes} />
          </Stack>
        )}
      </Modal>
    </Container>
  )
}

export const Route = createFileRoute('/_auth/simulation')({ component: SimulationPage })
