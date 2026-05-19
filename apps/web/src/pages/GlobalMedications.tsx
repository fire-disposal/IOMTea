import { useMemo } from 'react'
import { Badge, Button, Container, Group, Paper, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core'
import { AccentPaper } from '../components/shared/AccentPaper'
import { IconPill, IconUsers } from '@tabler/icons-react'
import { createColumnHelper } from '@tanstack/react-table'
import { trpc } from '../trpc'
import { DataTable } from '../components/shared/DataTable'
import { QueryGate } from '../components/shared/QueryGate'
import { useNavigate } from '@tanstack/react-router'

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

  const columnHelper = createColumnHelper<any>()
  const columns = useMemo(() => [
    columnHelper.accessor('patientName', { header: '患者', cell: (info) => <Text fw={500}>{info.getValue()}</Text> }),
    columnHelper.accessor('drugName', { header: '药物', cell: (info) => info.getValue() }),
    columnHelper.accessor('dosage', { header: '剂量', cell: (info) => `${info.getValue()}${info.row.original.dosageUnit}` }),
    columnHelper.accessor('route', { header: '途径', cell: (info) => <Badge size="sm" variant="light" color="gray">{ROUTE_LABELS[info.getValue()] || info.getValue()}</Badge> }),
    columnHelper.accessor('status', { header: '状态', cell: (info) => <Badge size="sm" color={STATUS_COLORS[info.getValue()] || 'gray'}>{STATUS_LABELS[info.getValue()] || info.getValue()}</Badge> }),
    columnHelper.display({ id: 'actions', header: '操作', cell: (info) => <Button size="xs" variant="light" onClick={() => navigate({ to: '/patients/$id/medications', params: { id: info.row.original.patientId } })}>查看</Button> }),
  ], [navigate])

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="md">用药管理</Title>

      <SimpleGrid cols={2} mb="lg">
        <AccentPaper p="md" radius="md" withBorder color="matchaGreen">
          <Group>
            <ThemeIcon color="matchaGreen" variant="light"><IconPill size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">活跃用药数</Text>
              <Text fw={700} size="xl">{activeCount}</Text>
            </div>
          </Group>
        </AccentPaper>
        <AccentPaper p="md" radius="md" withBorder color="blue">
          <Group>
            <ThemeIcon color="blue" variant="light"><IconUsers size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">用药患者数</Text>
              <Text fw={700} size="xl">{patientsOnMeds}</Text>
            </div>
          </Group>
        </AccentPaper>
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
            <DataTable data={data} columns={columns} />
          )}
      </QueryGate>
      </Paper>
    </Container>
  )
}
