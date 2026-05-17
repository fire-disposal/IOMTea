import { useState, useMemo } from 'react'
import { Badge, Button, Container, Group, Paper, SegmentedControl, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core'
import { IconCalendar, IconCalendarWeek, IconList } from '@tabler/icons-react'
import { createColumnHelper } from '@tanstack/react-table'
import { trpc } from '../trpc'
import { DataTable } from '../components/shared/DataTable'
import { QueryGate } from '../components/shared/QueryGate'
import { useNavigate } from '@tanstack/react-router'

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  checkup: '体检', followup: '随访', emergency: '急诊', consultation: '咨询', rehabilitation: '康复',
}
const STATUS_COLORS: Record<string, string> = { scheduled: 'blue', confirmed: 'green', in_progress: 'yellow', completed: 'gray', cancelled: 'red', no_show: 'orange' }
const STATUS_LABELS: Record<string, string> = { scheduled: '待确认', confirmed: '已确认', in_progress: '进行中', completed: '已完成', cancelled: '已取消', no_show: '未出席' }

const FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '待确认', value: 'pending' },
]

export function GlobalAppointments() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string>('all')

  const patientsQuery = trpc.patient.list.useQuery({ pageSize: 100 })
  const apptsQuery = trpc.appointment.listAll.useQuery()

  const isPending = patientsQuery.isLoading || apptsQuery.isLoading
  const isError = patientsQuery.isError || apptsQuery.isError
  const patients = patientsQuery.data ?? []

  const patientNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of patients) map.set(p.id, p.name)
    return map
  }, [patients])

  const allAppointments = useMemo(() => {
    return (apptsQuery.data ?? []).map((a) => ({
      ...a,
      patientName: patientNameMap.get(a.patientId) || a.patientId.slice(0, 8),
      patientId: a.patientId,
    }))
  }, [apptsQuery.data, patientNameMap])

  const todayStr = new Date().toDateString()
  const todayAppts = useMemo(() => allAppointments.filter((a: any) => new Date(a.scheduledAt).toDateString() === todayStr), [allAppointments])

  const weekAppts = useMemo(() => {
    const now = new Date()
    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() + 7)
    return allAppointments.filter((a: any) => {
      const d = new Date(a.scheduledAt)
      return d >= now && d <= weekEnd
    })
  }, [allAppointments])

  const pendingAppts = useMemo(() => allAppointments.filter((a: any) => a.status === 'scheduled'), [allAppointments])

  const filteredAppts = useMemo(() => {
    switch (filter) {
      case 'today': return todayAppts
      case 'week': return weekAppts
      case 'pending': return pendingAppts
      default: return allAppointments
    }
  }, [filter, todayAppts, weekAppts, pendingAppts, allAppointments])

  const columnHelper = createColumnHelper<any>()
  const columns = useMemo(() => [
    columnHelper.accessor('patientName', { header: '患者', cell: (info) => <Text fw={500}>{info.getValue()}</Text> }),
    columnHelper.accessor('appointmentType', { header: '类型', cell: (info) => <Badge size="sm" variant="light" color="gray">{APPOINTMENT_TYPE_LABELS[info.getValue()] || info.getValue()}</Badge> }),
    columnHelper.accessor('scheduledAt', { header: '时间', cell: (info) => <Text size="sm">{new Date(info.getValue() as string).toLocaleString()}</Text> }),
    columnHelper.accessor('status', { header: '状态', cell: (info) => <Badge size="sm" color={STATUS_COLORS[info.getValue()] || 'gray'}>{STATUS_LABELS[info.getValue()] || info.getValue()}</Badge> }),
    columnHelper.display({ id: 'actions', header: '操作', cell: (info) => <Button size="xs" variant="light" onClick={() => navigate({ to: '/patients/$id/appointments', params: { id: info.row.original.patientId } })}>查看</Button> }),
  ], [navigate])

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="md">预约管理</Title>

      <SimpleGrid cols={3} mb="lg">
        <Paper p="md" radius="md" withBorder style={{ borderLeft: '3px solid var(--mantine-color-blue-5)' }}>
          <Group>
            <ThemeIcon color="blue" variant="light"><IconCalendar size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">今日预约</Text>
              <Text fw={700} size="xl">{todayAppts.length}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder style={{ borderLeft: '3px solid var(--mantine-color-matchaGreen-5)' }}>
          <Group>
            <ThemeIcon color="matchaGreen" variant="light"><IconCalendarWeek size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">未来7天</Text>
              <Text fw={700} size="xl">{weekAppts.length}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder style={{ borderLeft: '3px solid var(--mantine-color-violet-5)' }}>
          <Group>
            <ThemeIcon color="violet" variant="light"><IconList size={20} /></ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">预约总数</Text>
              <Text fw={700} size="xl">{allAppointments.length}</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      <Paper p="lg" radius="md" withBorder>
        <Group mb="md">
          <SegmentedControl size="xs" value={filter} onChange={setFilter} data={FILTER_OPTIONS} />
        </Group>

        <QueryGate
          isLoading={isPending}
          isError={isError}
          data={filteredAppts}
          errorMessage="加载预约数据失败"
          emptyMessage="暂无预约记录"
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
