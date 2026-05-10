import { useState } from 'react'
import { Container, Title, Table, Button, Modal, TextInput, Select, Group, Loader, ActionIcon } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { trpc } from '../trpc'

type Gender = 'male' | 'female' | 'other'

export function PatientListPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', gender: '' as Gender | '', room: '', bedNumber: '' })

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.patient.list.useQuery({ pageSize: 100 })
  const create = trpc.patient.create.useMutation({
    onSuccess: () => { utils.patient.list.invalidate(); setCreateOpen(false); setForm({ name: '', gender: '', room: '', bedNumber: '' }); notifications.show({ title: '创建成功', message: '', color: 'green' }) },
  })
  const update = trpc.patient.update.useMutation({
    onSuccess: () => { utils.patient.list.invalidate(); setEditId(null); notifications.show({ title: '更新成功', message: '', color: 'green' }) },
  })
  const del = trpc.patient.delete.useMutation({
    onSuccess: () => { utils.patient.list.invalidate(); notifications.show({ title: '已删除', message: '', color: 'orange' }) },
  })

  if (isLoading) return <Container py="xl"><Loader /></Container>

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>患者管理</Title>
        <Button size="sm" onClick={() => setCreateOpen(true)}>新增患者</Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>姓名</Table.Th><Table.Th>性别</Table.Th><Table.Th>房间</Table.Th><Table.Th>床位</Table.Th><Table.Th>状态</Table.Th><Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data?.map((p: any) => (
            <Table.Tr key={p.id}>
              <Table.Td>{p.name}</Table.Td>
              <Table.Td>{p.gender || '-'}</Table.Td>
              <Table.Td>{p.room || '-'}</Table.Td>
              <Table.Td>{p.bedNumber || '-'}</Table.Td>
              <Table.Td>{p.status}</Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <ActionIcon size="sm" variant="subtle" onClick={() => { setEditId(p.id); setForm({ name: p.name, gender: p.gender || '', room: p.room || '', bedNumber: p.bedNumber || '' }) }}>✏️</ActionIcon>
                  <ActionIcon size="sm" variant="subtle" color="red" onClick={() => del.mutate({ id: p.id })}>🗑</ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {/* Create Modal */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="新增患者">
        <TextInput label="姓名" required value={form.name} onChange={e => setForm({ ...form, name: e.currentTarget.value })} mb="sm" />
        <Select label="性别" data={['male', 'female', 'other']} value={form.gender || null} onChange={v => setForm({ ...form, gender: (v as Gender | '') || '' })} mb="sm" />
        <TextInput label="房间" value={form.room} onChange={e => setForm({ ...form, room: e.currentTarget.value })} mb="sm" />
        <TextInput label="床位" value={form.bedNumber} onChange={e => setForm({ ...form, bedNumber: e.currentTarget.value })} mb="sm" />
        <Button fullWidth onClick={() => create.mutate({ name: form.name, gender: form.gender || undefined, room: form.room || undefined, bedNumber: form.bedNumber || undefined })} loading={create.isPending}>创建</Button>
      </Modal>

      {/* Edit Modal */}
      <Modal opened={!!editId} onClose={() => setEditId(null)} title="编辑患者">
        <TextInput label="姓名" required value={form.name} onChange={e => setForm({ ...form, name: e.currentTarget.value })} mb="sm" />
        <Select label="性别" data={['male', 'female', 'other']} value={form.gender || null} onChange={v => setForm({ ...form, gender: (v as Gender | '') || '' })} mb="sm" />
        <TextInput label="房间" value={form.room} onChange={e => setForm({ ...form, room: e.currentTarget.value })} mb="sm" />
        <TextInput label="床位" value={form.bedNumber} onChange={e => setForm({ ...form, bedNumber: e.currentTarget.value })} mb="sm" />
        <Button fullWidth onClick={() => update.mutate({ id: editId!, data: { name: form.name, gender: form.gender || undefined, room: form.room || undefined, bedNumber: form.bedNumber || undefined } })} loading={update.isPending}>保存</Button>
      </Modal>
    </Container>
  )
}
