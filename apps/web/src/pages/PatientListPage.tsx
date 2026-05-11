import { ActionIcon, Button, Container, Group, Loader, Modal, Select, Stack, Table, Text, TextInput, Title, Alert } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { trpc } from '../trpc'

export function PatientListPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const utils = trpc.useUtils()
  const { data, isLoading, isError, error } = trpc.patient.list.useQuery({ pageSize: 100 })
  const create = trpc.patient.create.useMutation({ onSuccess: () => { utils.patient.list.invalidate(); setCreateOpen(false); form.reset(); notifications.show({ title: '已创建', message: '', color: 'green' }) } })
  const update = trpc.patient.update.useMutation({ onSuccess: () => { utils.patient.list.invalidate(); setEditId(null); form.reset(); notifications.show({ title: '已更新', message: '', color: 'green' }) } })
  const del = trpc.patient.delete.useMutation({ onSuccess: () => { utils.patient.list.invalidate(); setDeleteConfirm(null); notifications.show({ title: '已删除', message: '', color: 'orange' }) } })

  const form = useForm({
    initialValues: { name: '', gender: '', room: '', bedNumber: '' },
    validate: { name: (v: string) => (v.trim() ? null : '姓名为必填项') },
  })

  const patients = (data as any[]) || []

  if (isLoading) return <Container py="xl"><Group justify="center"><Loader /><Text c="dimmed">加载中...</Text></Group></Container>
  if (isError) return <Container py="xl"><Alert color="red" title="加载失败">{error?.message || '请检查网络连接'}</Alert></Container>

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>患者管理</Title>
        <Button size="sm" onClick={() => { form.reset(); setCreateOpen(true) }}>添加患者</Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead><Table.Tr><Table.Th>姓名</Table.Th><Table.Th>性别</Table.Th><Table.Th>房间</Table.Th><Table.Th>床位</Table.Th><Table.Th>状态</Table.Th><Table.Th>操作</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>
          {patients.length === 0 ? (
            <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="md">暂无患者</Text></Table.Td></Table.Tr>
          ) : patients.map((p: any) => (
            <Table.Tr key={p.id}>
              <Table.Td>{p.name}</Table.Td><Table.Td>{p.gender || '-'}</Table.Td><Table.Td>{p.room || '-'}</Table.Td><Table.Td>{p.bedNumber || '-'}</Table.Td><Table.Td>{p.status}</Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <ActionIcon size="sm" variant="subtle" aria-label="编辑" onClick={() => { setEditId(p.id); form.setValues({ name: p.name, gender: p.gender || '', room: p.room || '', bedNumber: p.bedNumber || '' }) }}>✏️</ActionIcon>
                  <ActionIcon size="sm" variant="subtle" color="red" aria-label="删除" onClick={() => setDeleteConfirm(p.id)}>🗑</ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal opened={createOpen || !!editId} onClose={() => { setCreateOpen(false); setEditId(null) }} title={editId ? '编辑患者' : '添加患者'}>
        <form onSubmit={form.onSubmit(() => { editId ? update.mutate({ id: editId, data: form.values as any }) : create.mutate(form.values as any) })}>
          <Stack gap="sm">
            <TextInput label="姓名" required {...form.getInputProps('name')} />
            <Select label="性别" data={['male', 'female', 'other']} {...form.getInputProps('gender')} clearable />
            <TextInput label="房间" {...form.getInputProps('room')} />
            <TextInput label="床位" {...form.getInputProps('bedNumber')} />
            <Button type="submit" fullWidth loading={create.isPending || update.isPending}>{editId ? '保存' : '创建'}</Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="确认删除" size="sm">
        <Text mb="lg">确定要删除此患者吗？此操作不可撤销。</Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>取消</Button>
          <Button color="red" loading={del.isPending} onClick={() => del.mutate({ id: deleteConfirm! })}>删除</Button>
        </Group>
      </Modal>
    </Container>
  )
}
