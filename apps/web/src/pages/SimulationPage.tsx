import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Skeleton,
  Switch,
  Text,
  Title,
  TextInput,
} from '@mantine/core'
import { IconPlus, IconTrash, IconPlayerPlay } from '@tabler/icons-react'
import { useState } from 'react'
import { useDelete, useGet, usePost } from '../api/hooks'
import { http } from '../api/client'

interface SimConfig {
  id: string
  name: string
  profileName: string
  running: boolean
  patientCount: number
}

export function SimulationPage() {
  const { data: sims, isLoading, refetch } = useGet<SimConfig[]>('/twin/simulations')
  const createSim = usePost('/twin/simulations', ['twin'])
  const [newName, setNewName] = useState('')

  const toggleSim = async (id: string) => {
    try { await http.post(`/twin/simulations/${id}/toggle`); refetch() } catch {}
  }
  const deleteSim = async (id: string) => {
    try { await http.delete(`/twin/simulations/${id}`); refetch() } catch {}
  }

  if (isLoading)
    return (
      <Container py="md">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={40} mb="sm" />
        ))}
      </Container>
    )

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>模拟工厂</Title>
        <Group>
          <TextInput
            size="xs"
            placeholder="模拟名称"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
          />
          <Button
            size="xs"
            leftSection={<IconPlus size={12} />}
            onClick={() => {
              createSim.mutate({ name: newName || '新模拟', profile: 'elderly-cardiac' } as any, {
                onSuccess: () => { setNewName(''); refetch() },
              })
            }}
          >
            创建
          </Button>
        </Group>
      </Group>
      {(sims ?? []).map((s) => (
        <Paper key={s.id} p="sm" mb="sm" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Switch
                checked={s.running}
                onChange={() => toggleSim(s.id)}
                size="sm"
                label={s.running ? '运行中' : '已停止'}
              />
              <Text fw={600}>{s.name}</Text>
              <Badge size="xs" variant="outline">{s.profileName}</Badge>
              <Badge size="xs">{s.patientCount} patients</Badge>
            </Group>
            <ActionIcon variant="light" color="red" onClick={() => deleteSim(s.id)}>
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Paper>
      ))}
    </Container>
  )
}
