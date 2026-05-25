import { useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconTrash, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react'
import { trpc } from '../trpc'

const METRIC_OPTIONS = [
  { value: 'heart_rate', label: '心率', unit: 'bpm', defaultMin: 60, defaultMax: 100 },
  { value: 'spo2', label: '血氧', unit: '%', defaultMin: 94, defaultMax: 100 },
  { value: 'systolic_bp', label: '收缩压', unit: 'mmHg', defaultMin: 100, defaultMax: 140 },
  { value: 'diastolic_bp', label: '舒张压', unit: 'mmHg', defaultMin: 60, defaultMax: 90 },
  { value: 'temperature', label: '体温', unit: '°C', defaultMin: 36, defaultMax: 37.5 },
  { value: 'resp_rate', label: '呼吸率', unit: 'rpm', defaultMin: 12, defaultMax: 20 },
  { value: 'glucose', label: '血糖', unit: 'mmol/L', defaultMin: 4, defaultMax: 8 },
]

export function VirtualPinsPage() {
  const utils = trpc.useUtils()
  const pins = trpc.virtualPin.list.useQuery(undefined, { refetchInterval: 5000 })
  const users = trpc.user.list.useQuery({ page: 1, pageSize: 100 })
  const saveMut = trpc.virtualPin.save.useMutation({
    onSuccess: () => {
      utils.virtualPin.list.invalidate()
      setCreateOpen(false)
      notifications.show({ title: '已保存', message: '', color: 'green' })
    },
    onError: (e: any) => notifications.show({ title: '失败', message: e.message, color: 'red' }),
  })
  const deleteMut = trpc.virtualPin.delete.useMutation({
    onSuccess: () => {
      utils.virtualPin.list.invalidate()
      notifications.show({ title: '已删除', message: '', color: 'orange' })
    },
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({
    userId: '',
    label: '',
    nickname: '',
    metrics: METRIC_OPTIONS.slice(0, 4).map((m) => ({
      metric: m.value,
      min: m.defaultMin,
      max: m.defaultMax,
      unit: m.unit,
      variance: 0.1,
    })),
    intervalMs: 10000,
    enabled: true,
  })

  const openCreate = () => {
    setEditing(null)
    setForm({
      userId: '',
      label: '',
      nickname: '',
      metrics: METRIC_OPTIONS.slice(0, 4).map((m) => ({
        metric: m.value,
        min: m.defaultMin,
        max: m.defaultMax,
        unit: m.unit,
        variance: 0.1,
      })),
      intervalMs: 10000,
      enabled: true,
    })
    setCreateOpen(true)
  }
  const openEdit = (pin: any) => {
    const cfg = pin.generatorConfig as any
    setEditing(pin)
    setForm({
      userId: pin.userId,
      label: pin.label || '',
      nickname: pin.nickname || '',
      metrics: cfg?.metrics || [],
      intervalMs: cfg?.intervalMs || 10000,
      enabled: cfg?.enabled ?? true,
    })
    setCreateOpen(true)
  }

  const save = () => {
    saveMut.mutate({
      pin: editing?.pin,
      userId: form.userId,
      label: form.label,
      nickname: form.nickname,
      generatorConfig: {
        enabled: form.enabled,
        intervalMs: form.intervalMs,
        metrics: form.metrics,
      },
    })
  }

  const toggleMetric = (metric: string) => {
    setForm((prev) => {
      const exists = prev.metrics.find((m) => m.metric === metric)
      if (exists) return { ...prev, metrics: prev.metrics.filter((m) => m.metric !== metric) }
      const opt = METRIC_OPTIONS.find((m) => m.value === metric)
      return {
        ...prev,
        metrics: [
          ...prev.metrics,
          {
            metric,
            min: opt?.defaultMin ?? 0,
            max: opt?.defaultMax ?? 100,
            unit: opt?.unit ?? '',
            variance: 0.1,
          },
        ],
      }
    })
  }

  const userOptions = (users.data ?? []).map((u: any) => ({
    value: u.id,
    label: u.displayName || u.username,
  }))

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>虚拟 PIN 管理</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          新建虚拟 PIN
        </Button>
      </Group>

      <Paper p="lg" radius="md" withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>PIN</Table.Th>
              <Table.Th>昵称</Table.Th>
              <Table.Th>状态</Table.Th>
              <Table.Th>指标数</Table.Th>
              <Table.Th>间隔</Table.Th>
              <Table.Th>最后活跃</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(pins.data ?? []).map((p: any) => {
              const cfg = p.generatorConfig as any
              return (
                <Table.Tr key={p.pin}>
                  <Table.Td>
                    <Badge variant="light">{p.pin}</Badge>
                  </Table.Td>
                  <Table.Td>{p.nickname || p.label || '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={cfg?.enabled ? 'green' : 'gray'} variant="filled">
                      {cfg?.enabled ? '运行中' : '已停止'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{cfg?.metrics?.length ?? 0} 项</Table.Td>
                  <Table.Td>{(cfg?.intervalMs ?? 10000) / 1000}s</Table.Td>
                  <Table.Td>
                    {p.lastSeenAt ? new Date(p.lastSeenAt as string).toLocaleString() : '—'}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="light" onClick={() => openEdit(p)}>
                        <Text size="xs">✏️</Text>
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => deleteMut.mutate({ pin: p.pin })}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editing ? '编辑虚拟 PIN' : '创建虚拟 PIN'}
        size="lg"
      >
        <Stack gap="sm">
          <Select
            label="关联用户"
            data={userOptions}
            value={form.userId}
            onChange={(v) => setForm({ ...form, userId: v || '' })}
            searchable
            required
          />
          <Group grow>
            <TextInput
              label="标签"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.currentTarget.value })}
            />
            <TextInput
              label="昵称"
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.currentTarget.value })}
            />
          </Group>
          <NumberInput
            label="生成间隔 (ms)"
            value={form.intervalMs}
            onChange={(v) => setForm({ ...form, intervalMs: typeof v === 'number' ? v : 10000 })}
            min={1000}
            max={300000}
            step={1000}
          />
          <Button
            variant={form.enabled ? 'filled' : 'outline'}
            color={form.enabled ? 'green' : 'gray'}
            size="xs"
            onClick={() => setForm({ ...form, enabled: !form.enabled })}
          >
            {form.enabled ? '🟢 已启用 (点击停止)' : '⚪ 已停止 (点击启动)'}
          </Button>

          <Text size="sm" fw={500} mt="sm">
            生成指标:
          </Text>
          <Group gap="xs">
            {METRIC_OPTIONS.map((opt) => {
              const active = form.metrics.some((m) => m.metric === opt.value)
              return (
                <Badge
                  key={opt.value}
                  size="sm"
                  color={active ? 'matchaGreen' : 'gray'}
                  variant={active ? 'filled' : 'outline'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleMetric(opt.value)}
                >
                  {opt.label}
                </Badge>
              )
            })}
          </Group>

          {form.metrics.map((m, i) => (
            <Group key={m.metric} grow>
              <Text size="xs">{m.metric}</Text>
              <NumberInput
                size="xs"
                label="下限"
                value={m.min}
                onChange={(v) => {
                  const n = [...form.metrics]
                  n[i] = { ...n[i], min: typeof v === 'number' ? v : 0 }
                  setForm({ ...form, metrics: n })
                }}
              />
              <NumberInput
                size="xs"
                label="上限"
                value={m.max}
                onChange={(v) => {
                  const n = [...form.metrics]
                  n[i] = { ...n[i], max: typeof v === 'number' ? v : 100 }
                  setForm({ ...form, metrics: n })
                }}
              />
            </Group>
          ))}

          <Button fullWidth onClick={save} loading={saveMut.isPending} mt="md">
            {editing ? '保存' : '创建'}
          </Button>
        </Stack>
      </Modal>
    </Container>
  )
}
