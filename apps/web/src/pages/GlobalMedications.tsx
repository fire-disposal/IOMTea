import { Container, Group, Paper, Table, Badge, Text, Title, Skeleton, SimpleGrid, ThemeIcon } from '@mantine/core'
import { IconPill, IconClock, IconUsers } from '@tabler/icons-react'
import { trpc } from '../trpc'
import { StateEmpty } from '../components/shared/StateComponents'
import { useNavigate } from 'react-router-dom'

export function GlobalMedications() {
  const navigate = useNavigate()
  const patients = trpc.patient.list.useQuery({ pageSize: 100 })

  const totalPatients = patients.data?.length ?? 0

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="md">用药管理</Title>

      <SimpleGrid cols={3} mb="lg">
        <Paper p="md" radius="md" withBorder style={{ borderLeft: '3px solid var(--mantine-color-matchaGreen-5)' }}>
          <Group>
            <ThemeIcon color="matchaGreen" variant="light"><IconUsers size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">监护患者</Text>
              <Text fw={700} size="xl">{totalPatients}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder style={{ borderLeft: '3px solid var(--mantine-color-blue-5)' }}>
          <Group>
            <ThemeIcon color="blue" variant="light"><IconPill size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">用药管理</Text>
              <Text fw={700} size="xl">—</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder style={{ borderLeft: '3px solid var(--mantine-color-orange-5)' }}>
          <Group>
            <ThemeIcon color="orange" variant="light"><IconClock size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">待处理</Text>
              <Text fw={700} size="xl">—</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      <Paper p="lg" radius="md" withBorder>
        <Text c="dimmed" mb="md">点击患者姓名查看详情和进行用药操作</Text>

        {patients.isLoading && <Skeleton height={200} />}
        {patients.data && patients.data.length === 0 && <StateEmpty message="暂无患者" />}
        {patients.data && patients.data.length > 0 && (
          <Table striped highlightOnHover>
            <Table.Thead><Table.Tr>
              <Table.Th>患者</Table.Th><Table.Th>活跃用药数</Table.Th><Table.Th>最近用药</Table.Th><Table.Th>操作</Table.Th>
            </Table.Tr></Table.Thead>
            <Table.Tbody>
              {patients.data.map(p => (
                <PatientMedRow key={p.id} patientId={p.id} name={p.name} onClick={() => navigate(`/patients/${p.id}/medications`)} />
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Container>
  )
}

function PatientMedRow({ patientId, name, onClick }: { patientId: string; name: string; onClick: () => void }) {
  const meds = trpc.medication.list.useQuery({ patientId, status: 'active' }, { enabled: !!patientId })
  const count = meds.data?.length ?? 0
  const latest = meds.data?.[0]?.drugName ?? '—'

  return (
    <Table.Tr>
      <Table.Td><Text fw={500}>{name}</Text></Table.Td>
      <Table.Td><Badge color={count > 0 ? 'matchaGreen' : 'gray'}>{count}</Badge></Table.Td>
      <Table.Td><Text size="sm">{latest}</Text></Table.Td>
      <Table.Td><Text size="xs" c="matchaGreen" style={{ cursor: 'pointer' }} onClick={onClick}>查看详情 →</Text></Table.Td>
    </Table.Tr>
  )
}
