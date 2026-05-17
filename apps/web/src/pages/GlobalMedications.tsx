import { useMemo } from 'react'
import { Container, Paper, Table, Badge, Text, Title, SimpleGrid, ThemeIcon, Group, Button } from '@mantine/core'
import { IconPill, IconUsers } from '@tabler/icons-react'
import { trpc } from '../trpc'
import { QueryGate } from '../components/shared/QueryGate'
import { useNavigate } from 'react-router-dom'

const STATUS_COLORS: Record<string, string> = { active: 'green', completed: 'blue', paused: 'orange', cancelled: 'gray' }
const STATUS_LABELS: Record<string, string> = { active: '使用中', completed: '已完成', paused: '暂停', cancelled: '取消' }
const ROUTE_LABELS: Record<string, string> = { oral: '口服', injection: '注射', topical: '外用', inhalation: '吸入', other: '其他' }

export function GlobalMedications() {
  const navigate = useNavigate()

  const patientsQuery = trpc.patient.list.useQuery({ pageSize: 100 })
  const medsQuery = trpc.medication.listAll.useQuery({ status: 'active' })

  const isPending = patientsQuery.isLoading || medsQuery.isLoading
  const isError = patientsQuery.isError || medsQuery.isError
  const patients = patientsQuery.data ?? []

  const patientNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of patients) map.set(p.id, p.name)
    return map
  }, [patients])

  const allMeds = useMemo(() => {
    return (medsQuery.data ?? []).map((m) => ({
      ...m,
      patientName: patientNameMap.get(m.patientId) || m.patientId.slice(0, 8),
      patientId: m.patientId,
    }))
  }, [medsQuery.data, patientNameMap])

  const activeCount = allMeds.length
  const patientsOnMeds = useMemo(() => new Set(allMeds.map((m: any) => m.patientId)).size, [allMeds])

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="md">用药管理</Title>

      <SimpleGrid cols={2} mb="lg">
        <Paper p="md" radius="md" withBorder style={{ borderLeft: '3px solid var(--mantine-color-matchaGreen-5)' }}>
          <Group>
            <ThemeIcon color="matchaGreen" variant="light"><IconPill size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">活跃用药数</Text>
              <Text fw={700} size="xl">{activeCount}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder style={{ borderLeft: '3px solid var(--mantine-color-blue-5)' }}>
          <Group>
            <ThemeIcon color="blue" variant="light"><IconUsers size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">用药患者数</Text>
              <Text fw={700} size="xl">{patientsOnMeds}</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      <Paper p="lg" radius="md" withBorder>
        <Text c="dimmed" size="sm" mb="md">点击患者姓名查看详情和进行用药操作</Text>

        <QueryGate
          isLoading={isPending}
          isError={isError}
          data={allMeds}
          errorMessage="加载用药数据失败"
          emptyMessage="暂无活跃用药记录"
          skeletonCount={4}
          onRetry={() => patientsQuery.refetch()}
        >
          {(data) => (
            <Table striped highlightOnHover>
              <Table.Thead><Table.Tr>
                <Table.Th>患者</Table.Th><Table.Th>药物</Table.Th><Table.Th>剂量</Table.Th><Table.Th>途径</Table.Th><Table.Th>状态</Table.Th><Table.Th>操作</Table.Th>
              </Table.Tr></Table.Thead>
              <Table.Tbody>
                {data.map((m: any) => (
                <Table.Tr key={m.id}>
                  <Table.Td><Text fw={500}>{m.patientName}</Text></Table.Td>
                  <Table.Td>{m.drugName}</Table.Td>
                  <Table.Td>{m.dosage}{m.dosageUnit}</Table.Td>
                  <Table.Td><Badge size="sm" variant="light" color="gray">{ROUTE_LABELS[m.route] || m.route}</Badge></Table.Td>
                  <Table.Td><Badge size="sm" color={STATUS_COLORS[m.status] || 'gray'}>{STATUS_LABELS[m.status] || m.status}</Badge></Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="light" onClick={() => navigate(`/patients/${m.patientId}/medications`)}>
                      查看
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </QueryGate>
      </Paper>
    </Container>
  )
}
