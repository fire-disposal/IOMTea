import {
  Container,
  Title,
  Paper,
  Group,
  Button,
  Select,
  Badge,
  Text,
  Grid,
  Stack,
  Table,
  NumberInput,
  ActionIcon,
  SegmentedControl,
  Divider,
  Modal,
  Switch,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  IconRefresh,
  IconChartBar,
  IconPlus,
  IconTrash,
  IconPencil,
  IconCheck,
  IconX,
} from '@tabler/icons-react'
import { api } from '../../../api/client'
import { SimTimeline } from '../components/SimTimeline'

const PROFILES = [
  { value: 'elderly-cardiac', label: '老年心脏' },
  { value: 'diabetes', label: '糖尿病' },
  { value: 'post-surgery', label: '术后恢复' },
  { value: 'copd-respiratory', label: 'COPD呼吸' },
  { value: 'maternity', label: '产科' },
]

const METRIC_LABELS: Record<string, string> = {
  heart_rate: '心率',
  resp_rate: '呼吸率',
  spo2: '血氧',
  temperature: '体温',
  systolic_bp: '收缩压',
  diastolic_bp: '舒张压',
  glucose: '血糖',
  posture: '姿态',
  bed_status: '卧床',
  motion_index: '活动指数',
}

export function SimPage() {
  const [patientList, setPatientList] = useState<any[]>([])
  const [simulations, setSimulations] = useState<any[]>([])
  const [simStatus, setSimStatus] = useState<any[]>([])
  const [selectedSimId, setSelectedSimId] = useState<string | null>(null)
  const [detailPatient, setDetailPatient] = useState<any>(null)
  const [timelineMinutes, setTimelineMinutes] = useState(10)
  const [creating, setCreating] = useState(false)
  const [newProfile, setNewProfile] = useState('elderly-cardiac')
  const [addPatientId, setAddPatientId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const [createLoading, setCreateLoading] = useState(false)

  const fetchPatients = useCallback(async () => {
    try {
      const { data } = await api.GET('/patients', { params: { query: { page: 1, pageSize: 200 } } })
      setPatientList(data ?? [])
    } catch { /* silent */ }
  }, [])

  const fetchSims = useCallback(async () => {
    try {
      const { data } = await api.GET('/twin/simulations')
      setSimulations(data ?? [])
    } catch { /* silent */ }
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await api.GET('/twin/simulations')
      const statusData: any[] = []
      for (const sim of data ?? []) {
        if (sim.patients) {
          for (const p of sim.patients) {
            statusData.push({ ...p, simId: sim.id, profile: sim.profileName })
          }
        }
      }
      setSimStatus(statusData)
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchPatients(); fetchSims(); fetchStatus() }, [fetchPatients, fetchSims, fetchStatus])
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchSims()
      fetchStatus()
    }, 2000)
    return () => clearInterval(pollRef.current)
  }, [fetchSims, fetchStatus])

  const handleCreate = async () => {
    setCreateLoading(true)
    try {
      const { data: d } = await api.POST('/twin/simulations', { body: { profile: newProfile } })
      fetchSims()
      setSelectedSimId(d?.id ?? null)
      setCreating(false)
      notifications.show({ title: '已创建', message: '', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: '创建失败', message: err.message, color: 'red' })
    } finally {
      setCreateLoading(false)
    }
  }

  const handleToggle = async (id: string, running: boolean) => {
    try {
      await api.POST('/twin/simulations/{id}/toggle', { params: { path: { id } }, body: { running } })
      fetchSims()
    } catch { /* silent */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.DELETE('/twin/simulations/{id}', { params: { path: { id } } })
      fetchSims()
      setSelectedSimId(null)
    } catch { /* silent */ }
  }

  const handleRename = async () => {
    if (editingName && editNameValue.trim()) {
      try {
        await api.PATCH('/twin/simulations/{id}/rename', { params: { path: { id: editingName } }, body: { name: editNameValue.trim() } })
        fetchSims()
        setEditingName(null)
      } catch { /* silent */ }
    } else {
      setEditingName(null)
    }
  }

  const handleToggleMetric = async (id: string, metric: string, enabled: boolean) => {
    try {
      await api.POST('/twin/simulations/{id}/metrics/{metric}/toggle', { params: { path: { id, metric } }, body: { enabled } })
      fetchSims()
    } catch { /* silent */ }
  }

  const handleMetricChange = async (metric: string, field: string, value: number) => {
    if (!selectedSimId) return
    try {
      await api.PATCH('/twin/simulations/{id}/metrics/{metric}', { params: { path: { id: selectedSimId, metric } }, body: { [field]: value } })
    } catch { /* silent */ }
  }

  const handleAddPatient = async () => {
    if (!selectedSimId || !addPatientId) return
    try {
      await api.POST('/twin/simulations/{id}/patients', { params: { path: { id: selectedSimId } }, body: { patientId: addPatientId } })
      fetchSims()
      fetchStatus()
      setAddPatientId(null)
    } catch { /* silent */ }
  }

  const handleRemovePatient = async (patientId: string) => {
    if (!selectedSimId) return
    try {
      await api.DELETE('/twin/simulations/{id}/patients/{patientId}', { params: { path: { id: selectedSimId, patientId } } })
      fetchSims()
      fetchStatus()
    } catch { /* silent */ }
  }

  const handleSetSpeed = async (speed: number) => {
    try {
      await api.PATCH('/twin/speed', { body: { speed } })
    } catch { /* silent */ }
  }

  const startRename = (simId: string, name: string) => {
    setEditingName(simId)
    setEditNameValue(name)
  }

  const selectedSim = selectedSimId ? simulations.find((s: any) => s.id === selectedSimId) : null
  const selectedSimPatients = simStatus.filter((s: any) => s.simId === selectedSimId)
  const assignedPatientIds = new Set(selectedSimPatients.map((s: any) => s.patientId))
  const unassignedPatientOptions = patientList
    .filter((p: any) => !assignedPatientIds.has(p.id))
    .map((p: any) => ({ value: p.id, label: p.name }))

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md">
        模拟数据工厂
      </Title>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Paper p="md" withBorder mb="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>模拟配置列表</Text>
              <Button
                size="compact-sm"
                variant="light"
                color={creating ? 'green' : undefined}
                onClick={() =>
                  creating ? handleCreate() : setCreating(true)
                }
                loading={createLoading}
                leftSection={<IconPlus size={14} />}
              >
                {creating ? '确认创建' : '从模板创建'}
              </Button>
            </Group>
            {creating && (
              <Select
                mb="sm"
                label="选择患者画像模板"
                data={PROFILES}
                value={newProfile}
                onChange={(v) => setNewProfile(v!)}
                description="模板仅提供初始配置，创建后可深度定制"
              />
            )}
          </Paper>

          {(simulations ?? []).length === 0 && !creating && (
            <Text c="dimmed" size="sm" ta="center" py="xl">
              暂无模拟配置，点击上方按钮从模板创建
            </Text>
          )}

          {(simulations ?? []).map((sim: any) => (
            <Paper
              key={sim.id}
              p="sm"
              withBorder
              mb="sm"
              style={{
                cursor: 'pointer',
                borderLeft:
                  selectedSimId === sim.id ? '3px solid var(--mantine-color-teal-5)' : undefined,
              }}
              onClick={() => setSelectedSimId(sim.id)}
            >
              <Group justify="space-between" mb={4}>
                <Group gap="xs">
                  <Switch
                    size="sm"
                    checked={sim.running}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleToggle(sim.id, e.currentTarget.checked)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                  {editingName === sim.id ? (
                    <Group gap={4} onClick={(e) => e.stopPropagation()}>
                      <TextInput
                        size="xs"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename()
                        }}
                        autoFocus
                      />
                      <ActionIcon size="xs" variant="subtle" color="green" onClick={handleRename}>
                        <IconCheck size={12} />
                      </ActionIcon>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="gray"
                        onClick={() => setEditingName(null)}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    </Group>
                  ) : (
                    <Group gap={4}>
                      <Text size="sm" fw={600}>
                        {sim.name}
                      </Text>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation()
                          startRename(sim.id, sim.name)
                        }}
                      >
                        <IconPencil size={10} />
                      </ActionIcon>
                    </Group>
                  )}
                </Group>
                <Group gap="xs">
                  <Badge size="xs" variant="light">
                    {sim.patientCount}人
                  </Badge>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(sim.id)
                    }}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Group>
              </Group>
              <Group gap={4}>
                {sim.metrics.filter((m: any) => m.enabled).length} / {sim.metrics.length} 指标启用
              </Group>
            </Paper>
          ))}
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 7 }}>
          {!selectedSim ? (
            <Paper p="xl" withBorder ta="center">
              <Text c="dimmed">← 选择左侧模拟配置查看详情</Text>
            </Paper>
          ) : (
            <Stack>
              <Paper p="md" withBorder>
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    {editingName === selectedSim.id ? (
                      <Group gap={4}>
                        <TextInput
                          size="xs"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename()
                          }}
                          autoFocus
                        />
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="green"
                          onClick={handleRename}
                        >
                          <IconCheck size={12} />
                        </ActionIcon>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={() => setEditingName(null)}
                        >
                          <IconX size={12} />
                        </ActionIcon>
                      </Group>
                    ) : (
                      <Group gap={4}>
                        <Text fw={600}>{selectedSim.name} — 指标编排</Text>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          onClick={() => startRename(selectedSim.id, selectedSim.name)}
                        >
                          <IconPencil size={12} />
                        </ActionIcon>
                      </Group>
                    )}
                    <Badge size="xs" variant="outline">
                      {PROFILES.find((p) => p.value === selectedSim.profileName)?.label}
                    </Badge>
                  </Group>
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    onClick={() => handleDelete(selectedSimId!)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>

                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>开关</Table.Th>
                      <Table.Th>指标</Table.Th>
                      <Table.Th>最小间隔(ms)</Table.Th>
                      <Table.Th>最大间隔(ms)</Table.Th>
                      <Table.Th>抖动</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedSim.metrics.map((m: any) => (
                      <Table.Tr key={m.name} opacity={m.enabled ? 1 : 0.4}>
                        <Table.Td>
                          <Switch
                            size="xs"
                            checked={m.enabled}
                            onChange={(e) =>
                              handleToggleMetric(selectedSim.id, m.name, e.currentTarget.checked)
                            }
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" fw={m.enabled ? 600 : 400}>
                            {METRIC_LABELS[m.name] ?? m.name}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            min={100}
                            max={600000}
                            w={80}
                            hideControls
                            value={m.config.interval.min}
                            disabled={!m.enabled}
                            onChange={(v) => handleMetricChange(m.name, 'intervalMin', Number(v))}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            min={100}
                            max={600000}
                            w={80}
                            hideControls
                            value={m.config.interval.max}
                            disabled={!m.enabled}
                            onChange={(v) => handleMetricChange(m.name, 'intervalMax', Number(v))}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            min={0}
                            max={1}
                            step={0.1}
                            decimalScale={2}
                            w={60}
                            hideControls
                            value={m.config.jitter}
                            disabled={!m.enabled}
                            onChange={(v) => handleMetricChange(m.name, 'jitter', Number(v))}
                          />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                <Divider my="md" />

                <Text fw={600} mb="sm">
                  分配患者
                </Text>
                <Group mb="sm">
                  <Select
                    size="sm"
                    data={unassignedPatientOptions}
                    value={addPatientId}
                    onChange={(v) => setAddPatientId(v)}
                    placeholder="搜索并选择患者..."
                    searchable
                    clearable
                    style={{ flex: 1 }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (addPatientId)
                        handleAddPatient()
                    }}
                    disabled={!addPatientId}
                  >
                    添加
                  </Button>
                </Group>

                {selectedSimPatients.map((sp: any) => (
                  <Paper
                    key={sp.patientId}
                    p="sm"
                    withBorder
                    mb="xs"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setDetailPatient(sp)
                      setTimelineMinutes(10)
                    }}
                  >
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        {sp.patientName}
                      </Text>
                      <Group gap="xs">
                        <Badge size="xs" variant="light">
                          tick: {sp.tickCount}
                        </Badge>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemovePatient(sp.patientId)
                          }}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                        <ActionIcon variant="light" color="blue" size="xs">
                          <IconChartBar size={12} />
                        </ActionIcon>
                      </Group>
                    </Group>
                    {(Object.entries(sp.lastValues ?? {}) as [string, number][])
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <Badge key={k} size="xs" variant="outline" mr={4} mt={4}>
                          {METRIC_LABELS[k] ?? k}:{' '}
                          {typeof v === 'number' ? v.toFixed(1) : String(v)}
                        </Badge>
                      ))}
                  </Paper>
                ))}
              </Paper>

              <Paper p="md" withBorder>
                <Text fw={600} mb="sm">
                  全局速度
                </Text>
                <SegmentedControl
                  data={[
                    { value: '0.5', label: '0.5x' },
                    { value: '1', label: '1x' },
                    { value: '2', label: '2x' },
                    { value: '5', label: '5x' },
                    { value: '10', label: '10x' },
                  ]}
                    onChange={(v) => handleSetSpeed(Number(v))}
                />
              </Paper>
            </Stack>
          )}
        </Grid.Col>
      </Grid>

      <Modal
        opened={!!detailPatient}
        onClose={() => setDetailPatient(null)}
        title={
          detailPatient?.patientName ? `${detailPatient.patientName} — 数据时间线` : '数据时间线'
        }
        size="xl"
      >
        {detailPatient && (
          <Stack>
            <Group>
              <Badge variant="light">
                {PROFILES.find((p) => p.value === detailPatient.profile)?.label}
              </Badge>
              <Text size="xs" c="dimmed">
                tick: {detailPatient.tickCount}
              </Text>
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

