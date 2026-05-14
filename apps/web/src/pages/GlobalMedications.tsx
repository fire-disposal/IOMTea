import { Container, Group, Paper, Table, Badge, Text, Title, Loader } from '@mantine/core'
import { trpc } from '../trpc'
import { StateEmpty } from '../components/shared/StateComponents'
import { useNavigate } from 'react-router-dom'

export function GlobalMedications() {
  const navigate = useNavigate()
  const patients = trpc.patient.list.useQuery({ pageSize: 100 })

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="md">用药管理</Title>
      <Text c="dimmed" mb="md">点击患者姓名查看详情和进行用药操作</Text>
      
      {patients.isLoading && <Loader />}
      {patients.data && patients.data.length === 0 && <StateEmpty message="暂无患者" />}
      {patients.data && patients.data.length > 0 && (
        <Paper><Table striped>
          <Table.Thead><Table.Tr>
            <Table.Th>患者</Table.Th><Table.Th>活跃用药数</Table.Th><Table.Th>最近用药</Table.Th><Table.Th>操作</Table.Th>
          </Table.Tr></Table.Thead>
          <Table.Tbody>
            {patients.data.map(p => (
              <PatientMedRow key={p.id} patientId={p.id} name={p.name} onClick={() => navigate(`/patients/${p.id}/medications`)} />
            ))}
          </Table.Tbody>
        </Table></Paper>
      )}
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
