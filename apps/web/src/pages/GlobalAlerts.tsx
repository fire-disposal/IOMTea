import { useState } from 'react'
import { Container, Group, Paper, SegmentedControl, Table, Badge, Text, Title, Loader, Button } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { trpc } from '../trpc'
import { StateEmpty } from '../components/shared/StateComponents'
import { useNavigate } from 'react-router-dom'

const STATUS_COLORS: Record<string, string> = { active: 'red', acknowledged: 'yellow', resolved: 'green' }
const SEVERITY_COLORS: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' }

export function GlobalAlerts() {
  const navigate = useNavigate()
  const [severity, setSeverity] = useState<'critical' | 'warning' | 'info' | ''>('')
  const [status, setStatus] = useState<'active' | 'acknowledged' | 'resolved' | ''>('')
  const alerts = trpc.alert.list.useQuery(
    { pageSize: 100, severity: severity || undefined, status: status || undefined },
    { refetchInterval: 15000 }
  )
  const ackMut = trpc.alert.acknowledge.useMutation({
    onSuccess: () => { notifications.show({ message: '已确认', color: 'green' }); alerts.refetch() },
  })
  const resolveMut = trpc.alert.resolve.useMutation({
    onSuccess: () => { notifications.show({ message: '已解决', color: 'green' }); alerts.refetch() },
  })

  const activeCount = alerts.data?.filter(a => a.status === 'active').length ?? 0
  const criticalCount = alerts.data?.filter(a => a.severity === 'critical').length ?? 0

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="md">告警中心</Title>
      
      <Group mb="md">
        <Paper p="sm" withBorder><Text size="xs" c="dimmed">未处理</Text><Text fw={700} size="xl">{activeCount}</Text></Paper>
        <Paper p="sm" withBorder><Text size="xs" c="dimmed">严重</Text><Text fw={700} size="xl" c="red">{criticalCount}</Text></Paper>
      </Group>

      <Group mb="md">
        <SegmentedControl size="xs" value={severity} onChange={(v) => setSeverity(v as typeof severity)} data={[
          { label: '全部', value: '' }, { label: '严重', value: 'critical' }, { label: '警告', value: 'warning' }, { label: '信息', value: 'info' },
        ]} />
        <SegmentedControl size="xs" value={status} onChange={(v) => setStatus(v as typeof status)} data={[
          { label: '全部', value: '' }, { label: '活跃', value: 'active' }, { label: '已确认', value: 'acknowledged' }, { label: '已解决', value: 'resolved' },
        ]} />
      </Group>

      {alerts.isLoading && <Loader />}
      {alerts.data && alerts.data.length === 0 && <StateEmpty message="暂无告警" />}
      {alerts.data && alerts.data.length > 0 && (
        <Paper><Table striped>
          <Table.Thead><Table.Tr>
            <Table.Th>患者</Table.Th><Table.Th>指标</Table.Th><Table.Th>严重度</Table.Th><Table.Th>状态</Table.Th><Table.Th>时间</Table.Th><Table.Th>操作</Table.Th>
          </Table.Tr></Table.Thead>
          <Table.Tbody>
            {alerts.data.map(a => (
              <Table.Tr key={a.id}>
                <Table.Td>
                  <Button variant="subtle" size="xs" onClick={() => navigate(`/patients/${a.patientId}`)}>
                    {a.patientId?.slice(0, 8)}
                  </Button>
                </Table.Td>
                <Table.Td>{a.metric} {a.value != null ? `${a.value} ${a.unit || ''}` : ''}</Table.Td>
                <Table.Td><Badge color={SEVERITY_COLORS[a.severity || ''] || 'gray'} size="xs">{a.severity}</Badge></Table.Td>
                <Table.Td><Badge color={STATUS_COLORS[a.status || ''] || 'gray'} size="xs">{a.status}</Badge></Table.Td>
                <Table.Td><Text size="xs">{new Date(a.recordedAt).toLocaleString()}</Text></Table.Td>
                <Table.Td>
                  {a.status === 'active' && <Button size="xs" variant="light" onClick={() => ackMut.mutate({ id: a.id })}>确认</Button>}
                  {(a.status === 'active' || a.status === 'acknowledged') && <Button size="xs" variant="light" color="green" ml={4} onClick={() => resolveMut.mutate({ id: a.id })}>解决</Button>}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table></Paper>
      )}
    </Container>
  )
}
