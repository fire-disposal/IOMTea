import { Container, Title, Table, Badge, Text, Paper } from '@mantine/core'
import { trpc } from '../trpc'
import { StateSkeleton, StateEmpty } from '../components/shared/StateComponents'

export function DeviceListPage() {
  const { data: devices, isLoading, isError } = trpc.device.list.useQuery({})

  if (isLoading) return <StateSkeleton variant="table" count={5} />
  if (isError) return <Text c="red" ta="center" py="xl">加载失败</Text>

  const list = devices ?? []

  return (
    <Container size="lg" py="md">
      <Title order={2} mb="md">设备列表</Title>
      {list.length === 0 ? (
        <StateEmpty message="暂无设备" />
      ) : (
        <Paper withBorder>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>序列号</Table.Th>
                <Table.Th>类型</Table.Th>
                <Table.Th>型号</Table.Th>
                <Table.Th>制造商</Table.Th>
                <Table.Th>固件版本</Table.Th>
                <Table.Th>状态</Table.Th>
                <Table.Th>最后在线</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((d: any) => (
                <Table.Tr key={d.id}>
                  <Table.Td>{d.serialNumber}</Table.Td>
                  <Table.Td>{d.deviceType}</Table.Td>
                  <Table.Td>{d.model ?? '-'}</Table.Td>
                  <Table.Td>{d.manufacturer ?? '-'}</Table.Td>
                  <Table.Td>{d.firmwareVersion ?? '-'}</Table.Td>
                  <Table.Td>
                    <Badge color={d.status === 'active' ? 'green' : d.status === 'error' ? 'red' : 'gray'} variant="light">
                      {d.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{d.lastSeen ? new Date(d.lastSeen).toLocaleString() : '-'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Container>
  )
}
