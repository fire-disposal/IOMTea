import { ActionIcon, Badge, Button, Container, Group, Loader, Modal, Select, Stack, Table, Text, TextInput, Title, Alert } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { trpc } from '../trpc'

const typeLabels: Record<string, string> = { mattress: '床垫', vision: '视觉', imu: 'IMU', generic: '通用', simulator: '仿真', custom: '自定义' }
const statusColor: Record<string, string> = { active: 'green', inactive: 'gray', maintenance: 'orange' }

export function DeviceListPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const utils = trpc.useUtils()
  const { data, isLoading, isError, error } = trpc.device.list.useQuery({ pageSize: 100 })
  const create = trpc.device.create.useMutation({ onSuccess: () => { utils.device.list.invalidate(); setCreateOpen(false); form.reset(); notifications.show({ title: '已创建', message: '', color: 'green' }) } })
  const update = trpc.device.update.useMutation({ onSuccess: () => { utils.device.list.invalidate(); notifications.show({ title: '已切换', message: '', color: 'blue' }) } })
  const del = trpc.device.delete.useMutation({ onSuccess: () => { utils.device.list.invalidate(); setDeleteConfirm(null); notifications.show({ title: '已删除', message: '', color: 'orange' }) } })

  const form = useForm({ initialValues: { serialNumber: '', deviceType: 'generic' }, validate: { serialNumber: (v: string) => (v.trim() ? null : '序列号为必填项') } })

  const devices = (data as any[]) || []
  if (isLoading) return <Container py="xl"><Group justify="center"><Loader /><Text c="dimmed">加载中...</Text></Group></Container>
  if (isError) return <Container py="xl"><Alert color="red" title="加载失败">{error?.message || '请检查网络连接'}</Alert></Container>

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>设备管理</Title>
        <Button size="sm" onClick={() => { form.reset(); setCreateOpen(true) }}>添加设备</Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead><Table.Tr><Table.Th>序列号</Table.Th><Table.Th>类型</Table.Th><Table.Th>状态</Table.Th><Table.Th>操作</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>
          {devices.length === 0 ? (
            <Table.Tr><Table.Td colSpan={4}><Text ta="center" c="dimmed" py="md">暂无设备</Text></Table.Td></Table.Tr>
          ) : devices.map((d: any) => (
            <Table.Tr key={d.id}>
              <Table.Td>{d.serialNumber}</Table.Td>
              <Table.Td><Badge size="xs" variant="light">{typeLabels[d.deviceType] || d.deviceType}</Badge></Table.Td>
              <Table.Td><Badge size="xs" color={statusColor[d.status]} variant="filled">{d.status}</Badge></Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <ActionIcon size="sm" variant="subtle" aria-label="切换状态" loading={update.isPending} onClick={() => update.mutate({ id: d.id, data: { status: d.status === 'active' ? 'inactive' : 'active' } })}>🔄</ActionIcon>
                  <ActionIcon size="sm" variant="subtle" color="red" aria-label="删除" onClick={() => setDeleteConfirm(d.id)}>🗑</ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="添加设备">
        <form onSubmit={form.onSubmit(() => create.mutate(form.values as any))}>
          <Stack gap="sm">
            <TextInput label="序列号" required {...form.getInputProps('serialNumber')} />
            <Select label="类型" data={Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v }))} {...form.getInputProps('deviceType')} />
            <Button type="submit" fullWidth loading={create.isPending}>创建</Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="确认删除" size="sm">
        <Text mb="lg">确定要删除此设备吗？</Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>取消</Button>
          <Button color="red" loading={del.isPending} onClick={() => del.mutate({ id: deleteConfirm! })}>删除</Button>
        </Group>
      </Modal>
    </Container>
  )
}
