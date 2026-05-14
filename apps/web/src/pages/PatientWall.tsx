import { useState } from 'react'
import { Container, Group, Paper, SimpleGrid, Text, TextInput, ThemeIcon, Title } from '@mantine/core'
import { IconAlertTriangle, IconDevices, IconSearch, IconUsers } from '@tabler/icons-react'
import { trpc } from '../trpc'
import { PatientCard } from '../components/patients/PatientCard'
import { StateSkeleton, StateEmpty, StateError } from '../components/shared/StateComponents'

export function PatientWall() {
  const [search, setSearch] = useState('')
  const patients = trpc.patient.list.useQuery({ pageSize: 100, status: 'active' })
  const alerts = trpc.alert.list.useQuery({ pageSize: 100 }, { refetchInterval: 30000 })

  const filtered = (patients.data || []).filter((p: any) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="lg">患者监护</Title>

      <SimpleGrid cols={3} mb="lg">
        <Paper p="md" radius="md" withBorder>
          <Group>
            <ThemeIcon color="matchaGreen" variant="light"><IconUsers size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">患者总数</Text>
              <Text fw={700} size="xl">{patients.data?.length ?? 0}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder>
          <Group>
            <ThemeIcon color="red" variant="light"><IconAlertTriangle size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">活跃告警</Text>
              <Text fw={700} size="xl">{alerts.data?.filter((a: any) => a.status === 'active').length ?? 0}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder>
          <Group>
            <ThemeIcon color="blue" variant="light"><IconDevices size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">在线设备</Text>
              <Text fw={700} size="xl">—</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      <TextInput
        placeholder="搜索患者..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="xl"
      />

      {patients.isLoading && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}><StateSkeleton count={6} /></SimpleGrid>
      )}
      {patients.isError && <StateError message="加载患者列表失败" />}
      {!patients.isLoading && !patients.isError && filtered.length === 0 && <StateEmpty message="暂无患者" />}
      {!patients.isLoading && !patients.isError && filtered.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {filtered.map((p: any) => (
            <PatientCard
              key={p.id}
              patient={p}
              alertCount={alerts.data?.filter((a: any) => a.patientId === p.id && a.status === 'active').length}
            />
          ))}
        </SimpleGrid>
      )}
    </Container>
  )
}
