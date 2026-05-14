import { Badge, Paper, Table, Text } from '@mantine/core'
import { useParams } from 'react-router-dom'
import { trpc } from '../trpc'
import { StateEmpty } from '../components/shared/StateComponents'

export function PatientMedications() {
  const { id } = useParams<{ id: string }>()
  const meds = trpc.medication.list.useQuery({ patientId: id! }, { enabled: !!id })

  if (!meds.data || meds.data.length === 0) {
    return <StateEmpty message="暂无用药记录" />
  }

  return (
    <Paper p="md" radius="md">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>药物</Table.Th>
            <Table.Th>剂量</Table.Th>
            <Table.Th>频率</Table.Th>
            <Table.Th>途径</Table.Th>
            <Table.Th>开始日期</Table.Th>
            <Table.Th>状态</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {meds.data.map((m: any) => (
            <Table.Tr key={m.id}>
              <Table.Td><Text fw={500}>{m.drugName}</Text></Table.Td>
              <Table.Td>{m.dosage}{m.dosageUnit}</Table.Td>
              <Table.Td>{m.frequency}</Table.Td>
              <Table.Td>{m.route}</Table.Td>
              <Table.Td>{m.startDate}</Table.Td>
              <Table.Td>
                <Badge color={m.status === 'active' ? 'green' : 'gray'}>{m.status}</Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  )
}
