import { Badge, Paper, Table, Text } from '@mantine/core'
import { useParams } from 'react-router-dom'
import { trpc } from '../trpc'
import { StateEmpty } from '../components/shared/StateComponents'

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'blue', confirmed: 'green', in_progress: 'yellow',
  completed: 'gray', cancelled: 'red', no_show: 'orange',
}

export function PatientAppointments() {
  const { id } = useParams<{ id: string }>()
  const appts = trpc.appointment.list.useQuery({ patientId: id! }, { enabled: !!id })

  if (!appts.data || appts.data.length === 0) {
    return <StateEmpty message="暂无预约记录" />
  }

  return (
    <Paper p="md" radius="md">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>类型</Table.Th>
            <Table.Th>时间</Table.Th>
            <Table.Th>地点</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th>原因</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {appts.data.map((a: any) => (
            <Table.Tr key={a.id}>
              <Table.Td>{a.appointmentType}</Table.Td>
              <Table.Td>{new Date(a.scheduledAt).toLocaleString()}</Table.Td>
              <Table.Td>{a.location}</Table.Td>
              <Table.Td><Badge color={STATUS_COLORS[a.status] || 'gray'} size="sm">{a.status}</Badge></Table.Td>
              <Table.Td>{a.reason || '—'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  )
}
