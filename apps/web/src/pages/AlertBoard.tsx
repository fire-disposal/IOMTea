import { Container, Title, Paper, Text, Badge, Group, ActionIcon, SegmentedControl } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface Alert {
  id: string; patientId: string; metric: string; value: unknown; unit: string | null
  severity: string | null; status: string | null; recordedAt: string | null
}

export function AlertBoard() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')

  const fetchAlerts = () => {
    http.get('/alerts', { params: { pageSize: 100 } }).then((res) => {
      setAlerts(res.data as Alert[])
      setLoading(false)
    })
  }
  useEffect(() => { fetchAlerts() }, [])

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status !== 'closed' && a.status !== 'resolved')

  const handleAction = async (id: string, action: string) => {
    try {
      await http.patch('/alerts/' + id, { action } as any)
      fetchAlerts()
    } catch { /* ignore */ }
  }

  if (loading) return <Container py="md"><Title order={2}>告警看板</Title><p>Loading...</p></Container>

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>告警看板</Title>
        <SegmentedControl
          data={[{ value: 'active', label: '活跃' }, { value: 'all', label: '全部' }]}
          value={filter} onChange={setFilter}
        />
      </Group>
      {filtered.map((a) => (
        <Paper key={a.id} p="sm" mb="xs" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Badge color={a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'yellow' : 'blue'} size="xs">
                {a.severity ?? 'info'}
              </Badge>
              <Text size="sm" fw={500}>{a.metric}: {String(a.value ?? '-')} {a.unit ?? ''}</Text>
            </Group>
            <Group gap="xs">
              {a.status === 'new' && (
                <ActionIcon variant="light" color="green" size="sm" onClick={() => handleAction(a.id, 'acknowledge')}>
                  <IconCheck size={14} />
                </ActionIcon>
              )}
              <Badge size="xs" variant="light">{a.status}</Badge>
            </Group>
          </Group>
        </Paper>
      ))}
    </Container>
  )
}
