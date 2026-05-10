import { useState } from 'react'
import { Container, Title, Table, Button, Modal, TextInput, Select, Group, Loader, ActionIcon, Badge } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { trpc } from '../trpc'

type DeviceType = 'mattress' | 'vision' | 'imu' | 'generic' | 'simulator' | 'custom'

const typeLabels: Record<string, string> = { mattress: '床垫', vision: '视觉', imu: 'IMU', generic: '通用', simulator: '仿真', custom: '自定义' }
const statusColor: Record<string, string> = { active: 'green', inactive: 'gray', maintenance: 'orange' }

export function DeviceListPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ serialNumber: '', deviceType: 'generic' as DeviceType })

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.device.list.useQuery({ pageSize: 100 })
  const create = trpc.device.create.useMutation({
    onSuccess: () => { utils.device.list.invalidate(); setCreateOpen(false); setForm({ serialNumber: '', deviceType: 'generic' }); notifications.show({ title: '创建成功', message: '', color: 'green' }) },
  })
  const update = trpc.device.update.useMutation({
    onSuccess: () => { utils.device.list.invalidate(); notifications.show({ title: '更新成功', message: '', color: 'green' }) },
  })
  const del = trpc.device.delete.useMutation({
    onSuccess: () => { utils.device.list.invalidate(); notifications.show({ title: '已删除', message: '', color: 'orange' }) },
  })

  if (isLoading) return <Container py="xl"><Loader /></Container>

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>设备管理</Title>
        <Button size="sm" onClick={() => setCreateOpen(true)}>新增设备</Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>序列号</Table.Th><Table.Th>类型</Table.Th><Table.Th>状态</Table.Th><Table.Th>最后在线</Table.Th><Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data?.map((d: any) => (
            <Table.Tr key={d.id}>
              <Table.Td>{d.serialNumber}</Table.Td>
              <Table.Td><Badge variant="light">{typeLabels[d.deviceType] || d.deviceType}</Badge></Table.Td>
              <Table.Td><Badge color={statusColor[d.status] || 'gray'}>{d.status}</Badge></Table.Td>
              <Table.Td>{d.lastSeen ? new Date(d.lastSeen).toLocaleString() : '-'}</Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <ActionIcon size="sm" variant="subtle" onClick={() => { update.mutate({ id: d.id, data: { status: d.status === 'active' ? 'inactive' : 'active' } }) }}>🔄</ActionIcon>
                  <ActionIcon size="sm" variant="subtle" color="red" onClick={() => del.mutate({ id: d.id })}>🗑</ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="新增设备">
        <TextInput label="序列号" required value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.currentTarget.value })} mb="sm" />
        <Select label="设备类型" data={['mattress','vision','imu','generic','simulator','custom']} value={form.deviceType} onChange={v => setForm({ ...form, deviceType: (v as DeviceType) || 'generic' })} mb="sm" />
        <Button fullWidth onClick={() => create.mutate(form)} loading={create.isPending}>创建</Button>
      </Modal>
    </Container>
  )
}
