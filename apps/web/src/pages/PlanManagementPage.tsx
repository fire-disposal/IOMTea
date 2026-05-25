import { Container, Title, Table, Button, Modal, TextInput, NumberInput, Textarea, Group, Badge, ActionIcon, Stack } from '@mantine/core'
import { IconPlus, IconTrash, IconEdit } from '@tabler/icons-react'
import { useState } from 'react'
import { useGet, usePost, usePatch, useDelete } from '../api/hooks'

interface Plan { id: string; code: string; title: string; rewardCredits: number; status: string; fields: Record<string, unknown>[]; cron: string | null; description: string | null }

export function PlanManagementPage() {
  const { data: plans, isLoading, refetch } = useGet<Plan[]>('/plans')
  const createPlan = usePost('/plans', ['plans'])
  const updatePlan = usePatch<Plan, Partial<Plan>>('/plans/:id', ['plans'])
  const deletePlan = useDelete('/plans/:id', ['plans'])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form, setForm] = useState({ code: '', title: '', description: '', fields: '[]', rewardCredits: 0, cron: '' })

  const openEdit = (p: Plan) => { setEditing(p); setForm({ code: p.code, title: p.title, description: p.description || '', fields: JSON.stringify(p.fields, null, 2), rewardCredits: p.rewardCredits, cron: p.cron || '' }); setModalOpen(true) }
  const openCreate = () => { setEditing(null); setForm({ code: '', title: '', description: '', fields: '[]', rewardCredits: 10, cron: '' }); setModalOpen(true) }

  const save = () => {
    const data = { ...form, fields: JSON.parse(form.fields || '[]') }
    if (editing) updatePlan.mutate({ id: editing.id, ...data } as any)
    else createPlan.mutate(data as any)
    setModalOpen(false)
  }

  if (isLoading) return <Container py="md"><Title order={2}>计划管理</Title></Container>

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>计划管理</Title>
        <Button size="xs" leftSection={<IconPlus size={12} />} onClick={openCreate}>新建计划</Button>
      </Group>
      <Table striped>
        <Table.Thead><Table.Tr><Table.Th>Code</Table.Th><Table.Th>标题</Table.Th><Table.Th>积分</Table.Th><Table.Th>字段数</Table.Th><Table.Th>Cron</Table.Th><Table.Th>状态</Table.Th><Table.Th>操作</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>{(plans ?? []).map((p) => (
          <Table.Tr key={p.id}>
            <Table.Td><Badge variant="light">{p.code}</Badge></Table.Td>
            <Table.Td>{p.title}</Table.Td>
            <Table.Td>{p.rewardCredits}</Table.Td>
            <Table.Td>{(p.fields || []).length}</Table.Td>
            <Table.Td><span style={{ fontSize: 11 }}>{p.cron || '-'}</span></Table.Td>
            <Table.Td><Badge size="xs" color={p.status === 'active' ? 'green' : 'gray'}>{p.status}</Badge></Table.Td>
            <Table.Td>
              <Group gap={4}>
                <ActionIcon size="xs" variant="light" onClick={() => openEdit(p)}><IconEdit size={12} /></ActionIcon>
                <ActionIcon size="xs" variant="light" color="red" onClick={() => deletePlan.mutate(p.id)}><IconTrash size={12} /></ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}</Table.Tbody>
      </Table>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '编辑计划' : '新建计划'} size="lg">
        <Stack gap="sm">
          <TextInput label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.currentTarget.value })} placeholder="daily-mood" disabled={!!editing} />
          <TextInput label="标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} placeholder="每日情绪量表" />
          <Textarea label="描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <Textarea label="Fields (JSON)" value={form.fields} onChange={(e) => setForm({ ...form, fields: e.currentTarget.value })} minRows={4} placeholder='[{"id":"mood","type":"likert","label":"心情","labels":["差","一般","好"]}]' />
          <NumberInput label="奖励积分" value={form.rewardCredits} onChange={(v) => setForm({ ...form, rewardCredits: Number(v) || 0 })} />
          <TextInput label="Cron" value={form.cron} onChange={(e) => setForm({ ...form, cron: e.currentTarget.value })} placeholder="0 8,20 * * *" />
          <Group justify="flex-end"><Button onClick={save}>保存</Button></Group>
        </Stack>
      </Modal>
    </Container>
  )
}
