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
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useDelete, useGet, usePost } from '../api/hooks'

interface SimConfig {
  id: string
  name: string
  profileName: string
  running: boolean
  patientCount: number
}

export function SimulationPage() {
  const { data: sims, isLoading, refetch } = useGet<SimConfig[]>('/twin/simulations')
  const createSim = usePost('/twin/simulations')

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
        <Button
          size="xs"
          leftSection={<IconPlus size={12} />}
          onClick={() => createSim.mutate({ profile: 'elderly-cardiac' } as any)}
        >
          创建
        </Button>
      </Group>
      {(sims ?? []).map((s) => (
        <Paper key={s.id} p="sm" mb="sm" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Switch checked={s.running} readOnly size="sm" />
              <Text fw={600}>{s.name}</Text>
              <Badge size="xs" variant="outline">
                {s.profileName}
              </Badge>
              <Badge size="xs">{s.patientCount} patients</Badge>
            </Group>
          </Group>
        </Paper>
      ))}
    </Container>
  )
}
