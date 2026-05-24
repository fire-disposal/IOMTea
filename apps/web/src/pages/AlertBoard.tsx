import { useState } from 'react'
import { Container, Title, Group, Paper, Badge, Text, Button, Textarea, Modal, Stack, SimpleGrid } from '@mantine/core'
import { AccentPaper } from '../components/shared/AccentPaper'
import { useDisclosure } from '@mantine/hooks'
import { trpc } from '../trpc'
import { StateSkeleton, StateError } from '../components/shared/StateComponents'

interface AlertItem {
  id: string
  patientId: string
  metric: string
  value: number | null
  unit?: string
  severity: string | null
  status: string | null
  recordedAt: number
  createdAt: number
}

const STATUS_LABELS: Record<string, string> = {
  new: '待处理',
  active: '活跃',
  acknowledged: '已确认',
  handled: '已处理',
  closed: '已关闭',
  resolved: '已解决',
}

export function AlertBoard() {
  const { data: alerts, refetch, isLoading, isError } = trpc.alert.list.useQuery({ pageSize: 100 })
  const handleMutation = trpc.alert.handle.useMutation()
  const closeMutation = trpc.alert.close.useMutation()

  const [selected, setSelected] = useState<AlertItem | null>(null)
  const [note, setNote] = useState('')
  const [resolution, setResolution] = useState('')
  const [opened, { open, close }] = useDisclosure(false)

  const newAlerts = alerts?.filter(a => a.status === 'new' || a.status === 'active') ?? []
  const handled = alerts?.filter(a => a.status === 'handled' || a.status === 'acknowledged') ?? []
  const completed = alerts?.filter(a => a.status === 'closed' || a.status === 'resolved') ?? []

  const handleMarkHandled = async () => {
    if (!selected) return
    await handleMutation.mutateAsync({ alertId: selected.id, note })
    setNote(''); close(); refetch()
  }

  const handleClose = async () => {
    if (!selected) return
    await closeMutation.mutateAsync({ alertId: selected.id, resolution })
    setResolution(''); close(); refetch()
  }

  const openDetail = (a: AlertItem) => {
    setSelected(a)
    setNote('')
    setResolution('')
    open()
  }

  if (isLoading) return (
    <Container size="xl" py="md">
      <Title order={2} mb="lg">告警管理</Title>
      <StateSkeleton count={1} variant="chart" />
    </Container>
  )
  if (isError) return (
    <Container size="xl" py="md">
      <Title order={2} mb="lg">告警管理</Title>
      <StateError message="加载告警失败" onRetry={refetch} />
    </Container>
  )

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="lg">告警管理</Title>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Paper shadow="xs" p="md" withBorder style={{ minHeight: 400, borderTop: '3px solid var(--mantine-color-red-5)' }}>
          <Group mb="sm">
            <Badge color="red" size="lg">{newAlerts.length}</Badge>
            <Text fw={600}>待处理</Text>
          </Group>
          {newAlerts.length === 0 && <Text size="sm" c="dimmed">暂无告警</Text>}
          {newAlerts.map(a => (
            <AccentPaper key={a.id} component="div" shadow="xs" p="sm" mb="xs" withBorder className="alert-card"
              style={{ cursor: 'pointer' }}
              color={a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'yellow' : 'blue'}
              onClick={() => openDetail(a)}>
              <Text size="sm" fw={500}>{a.metric}</Text>
              <Text size="xs" c="dimmed">{a.value}{a.unit ? ` ${a.unit}` : ''}</Text>
            </AccentPaper>
          ))}
        </Paper>

        <Paper shadow="xs" p="md" withBorder style={{ minHeight: 400, borderTop: '3px solid var(--mantine-color-yellow-5)' }}>
          <Group mb="sm">
            <Badge color="yellow" size="lg">{handled.length}</Badge>
            <Text fw={600}>已处理</Text>
          </Group>
          {handled.length === 0 && <Text size="sm" c="dimmed">暂无</Text>}
          {handled.map(a => (
            <AccentPaper key={a.id} component="div" shadow="xs" p="sm" mb="xs" withBorder className="alert-card"
              style={{ cursor: 'pointer' }}
              color={a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'yellow' : 'blue'}
              onClick={() => openDetail(a)}>
              <Text size="sm" fw={500}>{a.metric}</Text>
              <Text size="xs" c="dimmed">{STATUS_LABELS[a.status as string] || a.status}</Text>
            </AccentPaper>
          ))}
        </Paper>

        <Paper shadow="xs" p="md" withBorder style={{ minHeight: 400, borderTop: '3px solid var(--mantine-color-green-5)' }}>
          <Group mb="sm">
            <Badge color="green" size="lg">{completed.length}</Badge>
            <Text fw={600}>已完成</Text>
          </Group>
          {completed.length === 0 && <Text size="sm" c="dimmed">暂无</Text>}
          {completed.map(a => (
            <AccentPaper key={a.id} component="div" shadow="xs" p="sm" mb="xs" withBorder className="alert-card"
              color="green">
              <Text size="sm" fw={500}>{a.metric}</Text>
              <Text size="xs" c="dimmed">{new Date(a.recordedAt).toLocaleDateString()}</Text>
            </AccentPaper>
          ))}
        </Paper>
      </SimpleGrid>

      <Modal opened={opened} onClose={close} title="告警详情" size="lg">
        {selected && (
          <Stack>
            <Paper p="sm" withBorder>
              <Text fw={500}>指标: {selected.metric}</Text>
              <Text>值: {selected.value}{selected.unit ? ` ${selected.unit}` : ''}</Text>
              <Text size="sm" c="dimmed">{new Date(selected.recordedAt).toLocaleString()}</Text>
              <Badge mt="xs" color={selected.severity === 'critical' ? 'red' : selected.severity === 'warning' ? 'yellow' : 'blue'}>
                {STATUS_LABELS[selected.status as string] || selected.status}
              </Badge>
            </Paper>
            {(selected.status === 'new' || selected.status === 'active') && (
              <>
                <Textarea label="处理备注（可选）" placeholder="记录处理信息" onChange={e => setNote(e.target.value)} />
                <Button onClick={handleMarkHandled} loading={handleMutation.isPending} color="yellow">标记已处理</Button>
              </>
            )}
            {(selected.status === 'handled') && (
              <>
                <Textarea label="结案说明（可选）" placeholder="结案备注" onChange={e => setResolution(e.target.value)} />
                <Button onClick={handleClose} loading={closeMutation.isPending} color="green">结案</Button>
              </>
            )}
            {(selected.status === 'closed' || selected.status === 'resolved') && (
              <Text c="dimmed">此告警已完结</Text>
            )}
          </Stack>
        )}
      </Modal>
    </Container>
  )
}
