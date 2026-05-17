import { useState } from 'react'
import { Container, Title, Group, Paper, Badge, Text, Button, Select, Textarea, Modal, Stack, Card } from '@mantine/core'
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

export function AlertBoard() {
  const { data: alerts, refetch, isLoading, isError } = trpc.alert.list.useQuery({ pageSize: 100 })
  const { data: users } = trpc.user.list.useQuery({ page: 1, pageSize: 100 })
  const assignMutation = trpc.alert.assign.useMutation()
  const handleMutation = trpc.alert.handle.useMutation()
  const closeMutation = trpc.alert.close.useMutation()

  const [selected, setSelected] = useState<AlertItem | null>(null)
  const [assigneeId, setAssigneeId] = useState('')
  const [note, setNote] = useState('')
  const [resolution, setResolution] = useState('')
  const [opened, { open, close }] = useDisclosure(false)

  const assigneeOptions = (users ?? []).map((u) => ({
    value: u.id,
    label: u.displayName || u.username || u.id.slice(0, 8),
  }))

  const newAlerts = alerts?.filter(a => a.status === 'new' || a.status === 'active') ?? []
  const inProgress = alerts?.filter(a => a.status === 'assigned' || a.status === 'handled' || a.status === 'acknowledged') ?? []
  const completed = alerts?.filter(a => a.status === 'closed' || a.status === 'resolved') ?? []

  const handleAssign = async () => {
    if (!selected || !assigneeId) return
    await assignMutation.mutateAsync({ alertId: selected.id, assigneeId })
    setAssigneeId(''); close(); refetch()
  }

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
    setAssigneeId('')
    setNote('')
    setResolution('')
    open()
  }

  if (isLoading) return (
    <Container size="xl" py="md">
      <Title order={2} mb="lg">异常处置</Title>
      <StateSkeleton count={1} variant="chart" />
    </Container>
  )
  if (isError) return (
    <Container size="xl" py="md">
      <Title order={2} mb="lg">异常处置</Title>
      <StateError message="加载告警失败" onRetry={refetch} />
    </Container>
  )

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="lg">异常处置</Title>
      <Group align="flex-start" gap="md">
        <Paper shadow="xs" p="md" withBorder style={{ flex: 1, minHeight: 400 }}>
          <Group mb="sm">
            <Badge color="red" size="lg">{newAlerts.length}</Badge>
            <Text fw={600}>待处理</Text>
          </Group>
          {newAlerts.length === 0 && <Text size="sm" c="dimmed">暂无</Text>}
          {newAlerts.map(a => (
            <Card key={a.id} shadow="xs" p="sm" mb="xs" withBorder className="alert-card"
              style={{ cursor: 'pointer', borderLeft: `3px solid ${a.severity === 'critical' ? 'var(--mantine-color-red-5)' : a.severity === 'warning' ? 'var(--mantine-color-yellow-5)' : 'var(--mantine-color-blue-5)'}` }}
              onClick={() => openDetail(a)}>
              <Text size="sm" fw={500}>{a.metric}</Text>
              <Text size="xs" c="dimmed">{a.patientId?.slice(0, 8)}</Text>
            </Card>
          ))}
        </Paper>

        <Paper shadow="xs" p="md" withBorder style={{ flex: 1, minHeight: 400 }}>
          <Group mb="sm">
            <Badge color="yellow" size="lg">{inProgress.length}</Badge>
            <Text fw={600}>处理中</Text>
          </Group>
          {inProgress.length === 0 && <Text size="sm" c="dimmed">暂无</Text>}
          {inProgress.map(a => (
            <Card key={a.id} shadow="xs" p="sm" mb="xs" withBorder className="alert-card"
              style={{ cursor: 'pointer', borderLeft: `3px solid ${a.severity === 'critical' ? 'var(--mantine-color-red-5)' : a.severity === 'warning' ? 'var(--mantine-color-yellow-5)' : 'var(--mantine-color-blue-5)'}` }}
              onClick={() => openDetail(a)}>
              <Text size="sm">{a.metric}</Text>
              <Text size="xs" c="dimmed">{a.status}</Text>
            </Card>
          ))}
        </Paper>

        <Paper shadow="xs" p="md" withBorder style={{ flex: 1, minHeight: 400 }}>
          <Group mb="sm">
            <Badge color="green" size="lg">{completed.length}</Badge>
            <Text fw={600}>已完成</Text>
          </Group>
          {completed.length === 0 && <Text size="sm" c="dimmed">暂无</Text>}
          {completed.map(a => (
            <Card key={a.id} shadow="xs" p="sm" mb="xs" withBorder className="alert-card"
              style={{ borderLeft: '3px solid var(--mantine-color-green-5)' }}>
              <Text size="sm">{a.metric}</Text>
              <Text size="xs" c="dimmed">{new Date(a.recordedAt).toLocaleDateString()}</Text>
            </Card>
          ))}
        </Paper>
      </Group>

      <Modal opened={opened} onClose={close} title="告警详情" size="lg">
        {selected && (
          <Stack>
            <Text fw={500}>指标: {selected.metric}</Text>
            <Text>值: {selected.value}{selected.unit ? ` ${selected.unit}` : ''}</Text>
            <Text size="sm" c="dimmed">{new Date(selected.recordedAt).toLocaleString()}</Text>
            {(selected.status === 'new' || selected.status === 'active') && (
              <>
                <Select label="指派给" placeholder="选择处理人" data={assigneeOptions} searchable onChange={v => setAssigneeId(v || '')} />
                <Button onClick={handleAssign}>指派</Button>
              </>
            )}
            {(selected.status === 'assigned') && (
              <>
                <Textarea label="处理记录" onChange={e => setNote(e.target.value)} />
                <Button onClick={handleMarkHandled}>标记已处理</Button>
              </>
            )}
            {(selected.status === 'handled') && (
              <>
                <Textarea label="结案说明" onChange={e => setResolution(e.target.value)} />
                <Button onClick={handleClose}>结案</Button>
              </>
            )}
          </Stack>
        )}
      </Modal>
    </Container>
  )
}
