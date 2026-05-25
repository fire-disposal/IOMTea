import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Select,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface SimConfig {
  id: string
  name: string
  profileName: string
  running: boolean
  metrics: {
    name: string
    enabled: boolean
    config: { interval: { min: number; max: number }; jitter: number }
  }[]
  patientCount: number
}

export function SimulationPage() {
  const [sims, setSims] = useState<SimConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState('elderly-cardiac')

  const fetchSims = () => {
    http.get('/twin/simulations').then((r) => {
      setSims(r.data as SimConfig[])
      setLoading(false)
    })
  }
  useEffect(() => {
    fetchSims()
  }, [])

  const create = () => http.post('/twin/simulations', { profile } as any).then(fetchSims)
  const toggle = (id: string, running: boolean) =>
    http.post('/twin/simulations/' + id + '/toggle', { running } as any).then(fetchSims)
  const remove = (id: string) => http.delete('/twin/simulations/' + id).then(fetchSims)

  if (loading)
    return (
      <Container py="md">
        <Title order={2}>模拟工厂</Title>
        <p>Loading...</p>
      </Container>
    )

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>模拟工厂</Title>
        <Group>
          <Select
            size="sm"
            data={[
              { value: 'elderly-cardiac', label: '老年心脏' },
              { value: 'diabetes', label: '糖尿病' },
              { value: 'post-surgery', label: '术后' },
              { value: 'copd-respiratory', label: 'COPD' },
              { value: 'maternity', label: '产科' },
            ]}
            value={profile}
            onChange={(v) => setProfile(v ?? 'elderly-cardiac')}
          />
          <Button leftSection={<IconPlus size={12} />} size="sm" onClick={create}>
            创建
          </Button>
        </Group>
      </Group>
      {sims.map((s) => (
        <Paper key={s.id} p="sm" mb="sm" withBorder>
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <Switch
                checked={s.running}
                onChange={(e) => toggle(s.id, e.currentTarget.checked)}
                size="sm"
              />
              <Text fw={600}>{s.name}</Text>
              <Badge size="xs" variant="outline">
                {s.profileName}
              </Badge>
              <Badge size="xs">{s.patientCount} patients</Badge>
            </Group>
            <ActionIcon variant="light" color="red" onClick={() => remove(s.id)}>
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Paper>
      ))}
    </Container>
  )
}
