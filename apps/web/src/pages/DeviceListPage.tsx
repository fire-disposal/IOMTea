import { ActionIcon, Badge, Button, Container, Group, Modal, Select, Stack, Table, Text, TextInput, Title, Alert } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { trpc } from '../trpc'

const typeLabels: Record<string, string> = { mattress: '床垫', vision: '视觉', imu: 'IMU', generic: '通用', simulator: '仿真', custom: '自定义' }
const statusColor: Record<string, string> = { active: 'green', inactive: 'gray', maintenance: 'orange' }
const deviceTypeOptions = Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v }))
const statusOptions = ['active', 'inactive', 'maintenance'].map((s) => ({ value: s, label: s }))

export function DeviceListPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingTarget, setEditingTarget] = useState<any>(null)

  const utils = trpc.useUtils()
  const { data, isLoading, isError, error } = trpc.device.list.useQuery({ pageSize: 100 })
  const patients = trpc.patient.list.useQuery({ pageSize: 1000 })
  const create = trpc.device.create.useMutation({
    onSuccess: () => { utils.device.list.invalidate(); setCreateOpen(false); form.reset(); notifications.show({ title: '已创建', message: '', color: 'green' }) },
  })
  const updateMutation = trpc.device.update.useMutation({
    onSuccess: () => { utils.device.list.invalidate(); setEditingTarget(null); notifications.show({ title: '已更新', message: '', color: 'green' }) },
  })
  const del = trpc.device.delete.useMutation({
    onSuccess: () => { utils.device.list.invalidate(); setDeleteConfirm(null); notifications.show({ title: '已删除', message: '', color: 'orange' }) },
  })

  const form = useForm({
    initialValues: { serialNumber: '', deviceType: 'generic' },
    validate: { serialNumber: (v: string) => (v.trim() ? null : '序列号为必填项') },
  })

  const editForm = useForm({
    initialValues: { serialNumber: '', deviceType: 'generic', status: 'active', patientId: '' },
    validate: { serialNumber: (v: string) => (v.trim() ? null : '序列号为必填项') },
  })

  const patientMap = new Map((patients.data || []).map((p: any) => [p.id, p.name]))
  const patientOptions = [{ value: '', label: '未绑定' }, ...(patients.data || []).map((p: any) => ({ value: p.id, label: p.name }))]

  const devices = (data as any[]) || []

  const startEdit = (d: any) => {
    editForm.setValues({
      serialNumber: d.serialNumber || '',
      deviceType: d.deviceType || 'generic',
      status: d.status || 'active',
      patientId: d.patientId || '',
    })
    setEditingTarget(d)
  }

  if (isLoading) return <Container py="xl"><Group justify="center"><Text c="dimmed">加载中...</Text></Group></Container>
  if (isError) return <Container py="xl"><Alert color="red" title="加载失败">{error?.message || '请检查网络连接'}</Alert></Container>

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>设备管理</Title>
        <Button size="sm" onClick={() => { form.reset(); setCreateOpen(true) }}>添加设备</Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead><Table.Tr><Table.Th>序列号</Table.Th><Table.Th>类型</Table.Th><Table.Th>状态</Table.Th><Table.Th>患者</Table.Th><Table.Th>最后在线</Table.Th><Table.Th>操作</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>
          {devices.length === 0 ? (
            <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="md">暂无设备</Text></Table.Td></Table.Tr>
          ) : devices.map((d: any) => (
            <Table.Tr key={d.id}>
              <Table.Td>{d.serialNumber}</Table.Td>
              <Table.Td><Badge size="xs" variant="light">{typeLabels[d.deviceType] || d.deviceType}</Badge></Table.Td>
              <Table.Td><Badge size="xs" color={statusColor[d.status]} variant="filled">{d.status}</Badge></Table.Td>
              <Table.Td>{patientMap.get(d.patientId) || '—'}</Table.Td>
              <Table.Td>{d.lastSeen ? new Date(d.lastSeen).toLocaleString() : '—'}</Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <ActionIcon size="sm" variant="subtle" aria-label="编辑" onClick={() => startEdit(d)}>
                    <Text>✏️</Text>
                  </ActionIcon>
                  <ActionIcon size="sm" variant="subtle" color="red" aria-label="删除" onClick={() => setDeleteConfirm(d.id)}>
                    <Text>🗑</Text>
                  </ActionIcon>
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
            <Select label="类型" data={deviceTypeOptions} {...form.getInputProps('deviceType')} />
            <Button type="submit" fullWidth loading={create.isPending}>创建</Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!editingTarget} onClose={() => setEditingTarget(null)} title="编辑设备">
        <form onSubmit={editForm.onSubmit((vals) => updateMutation.mutate({ id: editingTarget!.id, data: vals } as any))}>
          <Stack gap="sm">
            <TextInput label="序列号" required {...editForm.getInputProps('serialNumber')} />
            <Select label="类型" data={deviceTypeOptions} {...editForm.getInputProps('deviceType')} />
            <Select label="患者" data={patientOptions} {...editForm.getInputProps('patientId')} />
            <Select label="状态" data={statusOptions} {...editForm.getInputProps('status')} />
            <Button type="submit" fullWidth loading={updateMutation.isPending}>保存</Button>
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
