import { Container, Paper, Table, Badge, Text, Title, Skeleton, SimpleGrid, ThemeIcon, Group } from '@mantine/core'
import { IconCalendar, IconClock, IconUsers } from '@tabler/icons-react'
import { trpc } from '../trpc'
import { StateEmpty } from '../components/shared/StateComponents'
import { useNavigate } from 'react-router-dom'

const STATUS_COLORS: Record<string, string> = { scheduled: 'blue', confirmed: 'green', in_progress: 'yellow', completed: 'gray', cancelled: 'red', no_show: 'orange' }

export function GlobalAppointments() {
  const navigate = useNavigate()
  const patients = trpc.patient.list.useQuery({ pageSize: 100 })

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="md">预约管理</Title>

      <SimpleGrid cols={3} mb="lg">
        <Paper p="md" radius="md" withBorder style={{ borderLeft: '3px solid var(--mantine-color-matchaGreen-5)' }}>
          <Group>
            <ThemeIcon color="matchaGreen" variant="light"><IconUsers size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">患者总数</Text>
              <Text fw={700} size="xl">{patients.data?.length ?? 0}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder style={{ borderLeft: '3px solid var(--mantine-color-blue-5)' }}>
          <Group>
            <ThemeIcon color="blue" variant="light"><IconCalendar size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">预约管理</Text>
              <Text fw={700} size="xl">—</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder style={{ borderLeft: '3px solid var(--mantine-color-orange-5)' }}>
          <Group>
            <ThemeIcon color="orange" variant="light"><IconClock size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">即将到来</Text>
              <Text fw={700} size="xl">—</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      <Paper p="lg" radius="md" withBorder>
        <Text c="dimmed" mb="md">点击患者姓名查看详情</Text>

        {patients.isLoading && <Skeleton height={200} />}
        {patients.data && patients.data.length === 0 && <StateEmpty message="暂无患者" />}
        {patients.data && patients.data.length > 0 && (
          <Table striped highlightOnHover>
            <Table.Thead><Table.Tr>
              <Table.Th>患者</Table.Th><Table.Th>即将到来的预约</Table.Th><Table.Th>时间</Table.Th><Table.Th>操作</Table.Th>
            </Table.Tr></Table.Thead>
            <Table.Tbody>
              {patients.data.map(p => (
                <PatientApptRow key={p.id} patientId={p.id} name={p.name} onClick={() => navigate(`/patients/${p.id}/appointments`)} />
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Container>
  )
}

function PatientApptRow({ patientId, name, onClick }: { patientId: string; name: string; onClick: () => void }) {
  const appts = trpc.appointment.list.useQuery(
    { patientId, status: 'scheduled' },
    { enabled: !!patientId }
  )
  const upcoming = appts.data?.find((a: any) => new Date(a.scheduledAt) > new Date())

  return (
    <Table.Tr>
      <Table.Td><Text fw={500}>{name}</Text></Table.Td>
      <Table.Td>
        {upcoming ? (
          <Badge color="matchaGreen">{upcoming.appointmentType}</Badge>
        ) : (
          <Text size="sm" c="dimmed">无</Text>
        )}
      </Table.Td>
      <Table.Td><Text size="sm">{upcoming ? new Date(upcoming.scheduledAt).toLocaleString() : '—'}</Text></Table.Td>
      <Table.Td><Text size="xs" c="matchaGreen" style={{ cursor: 'pointer' }} onClick={onClick}>查看详情 →</Text></Table.Td>
    </Table.Tr>
  )
}
