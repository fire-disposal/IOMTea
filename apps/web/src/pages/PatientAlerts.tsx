import { Container, Title, Paper, Badge, Group, Text, ActionIcon, SegmentedControl } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface Alert { id: string; metric: string; value: unknown; unit: string | null; severity: string | null; status: string | null; recordedAt: string | null }

export function PatientAlerts({ patientId }: { patientId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filter, setFilter] = useState('active')

  const fetch = () => {
    http.get('/alerts', { params: { patientId, pageSize: 100 } }).then((r) => setAlerts(r.data as Alert[]))
  }
  useEffect(() => { fetch() }, [patientId])

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status !== 'closed' && a.status !== 'resolved')

  const act = async (id: string, action: string) => {
    await http.patch('/alerts/' + id, { action } as any)
    fetch()
  }

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={3}>告警记录</Title>
        <SegmentedControl data={[{ value: 'active', label: '活跃' }, { value: 'all', label: '全部' }]} value={filter} onChange={setFilter} />
      </Group>
      {filtered.map((a) => (
        <Paper key={a.id} p="sm" mb="xs" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Badge color={a.severity === 'critical' ? 'red' : 'yellow'} size="xs">{a.severity}</Badge>
              <Text size="sm" fw={500}>{a.metric}: {String(a.value ?? '-')} {a.unit}</Text>
            </Group>
            <Group gap="xs">
              {a.status === 'new' && <ActionIcon variant="light" color="green" size="sm" onClick={() => act(a.id, 'acknowledge')}><IconCheck size={14} /></ActionIcon>}
              <Badge size="xs" variant="light">{a.status}</Badge>
            </Group>
          </Group>
        </Paper>
      ))}
    </Container>
  )
}
