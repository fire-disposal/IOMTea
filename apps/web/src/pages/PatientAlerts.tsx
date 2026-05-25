import { Paper, Badge, Group, Text, ActionIcon, SegmentedControl, Skeleton, Container } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface A { id: string; metric: string; value: unknown; unit: string | null; severity: string | null; status: string | null }
function parseId() { return window.location.pathname.split('/patients/')[1]?.split('/')[0] || '' }

export function PatientAlerts() {
  const pid = parseId()
  const [alerts, setAlerts] = useState<A[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')

  const fetch = () => {
    http.get('/alerts', { params: { patientId: pid, pageSize: 100 } }).then((r) => { setAlerts(r.data as A[]); setLoading(false) })
  }
  useEffect(() => { fetch() }, [pid])

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status !== 'closed' && a.status !== 'resolved')
  const act = (id: string, action: string) => http.patch('/alerts/' + id, { action } as any).then(fetch)

  if (loading) return <Container py="md">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={24} mb="sm" />)}</Container>

  return (
    <div>
      <Group justify="space-between" mb="md">
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
    </div>
  )
}
