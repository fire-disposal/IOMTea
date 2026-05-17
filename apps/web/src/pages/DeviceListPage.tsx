import { ActionIcon, Badge, Button, Group, Modal, Select, Stack, Table, Text, TextInput, Title, Alert, Skeleton, Paper, Container } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { trpc } from '../trpc'

const typeLabels: Record<string, string> = { mattress: '床垫', vision: '视觉', imu: 'IMU', generic: '通用', simulator: '仿真', custom: '自定义' }
const statusColor: Record<string, string> = { active: 'green', inactive: 'gray', maintenance: 'orange' }
const deviceTypeOptions = Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v }))
const statusOptions = ['active', 'inactive', 'maintenance'].map((s) => ({ value: s, label: s }))

export function DeviceListPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingTarget, setEditingTarget] = useState<any>(null)
  const [editKey, setEditKey] = useState(0)

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
    defaultValues: { serialNumber: '', deviceType: 'generic' as string },
    onSubmit: ({ value }) => create.mutate({ serialNumber: value.serialNumber.trim(), deviceType: value.deviceType as any }),
  })

  const startEdit = (d: any) => {
    setEditingTarget({ ...d })
    setEditKey((k) => k + 1)
  }

  const patientMap = new Map((patients.data || []).map((p: any) => [p.id, p.name]))
  const patientOptions = [{ value: '', label: '未绑定' }, ...(patients.data || []).map((p: any) => ({ value: p.id, label: p.name }))]
  const devices = (data as any[]) || []

  if (isLoading) return (
    <Container size="xl" py="xl">
      <Skeleton height={28} width={160} mb="md" />
      <Skeleton height={300} />
    </Container>
  )

  if (isError) return (
    <Container size="xl" py="xl">
      <Alert color="red" title="加载失败">{error?.message || '请检查网络连接'}</Alert>
    </Container>
  )

  return (
    <Container size="xl" py="md">
      <Paper p="lg" radius="md" withBorder>
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
      </Paper>

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="添加设备">
        <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
          <Stack gap="sm">
            <form.Field name="serialNumber">
              {(f) => <TextInput label="序列号" required value={f.state.value} onChange={(e) => f.handleChange(e.currentTarget.value)} error={f.state.meta.errors?.[0]} />}
            </form.Field>
            <form.Field name="deviceType">
              {(f) => <Select label="类型" data={deviceTypeOptions} value={f.state.value} onChange={(v) => f.handleChange(v ?? 'generic')} />}
            </form.Field>
            <Button type="submit" fullWidth loading={create.isPending}>创建</Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!editingTarget} onClose={() => setEditingTarget(null)} title="编辑设备">
        <EditForm key={editKey} target={editingTarget} updateMutation={updateMutation} onClose={() => setEditingTarget(null)} patientOptions={patientOptions} />
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

function EditForm({ target, updateMutation, onClose, patientOptions }: { target: any; updateMutation: any; onClose: () => void; patientOptions: { value: string; label: string }[] }) {
  const form = useForm({
    defaultValues: {
      serialNumber: target?.serialNumber || '',
      deviceType: (target?.deviceType || 'generic') as string,
      status: (target?.status || 'active') as string,
      patientId: target?.patientId || '',
    },
    onSubmit: ({ value }) => {
      updateMutation.mutate({ id: target.id, data: { serialNumber: value.serialNumber.trim(), deviceType: value.deviceType, status: value.status, patientId: value.patientId || null } } as any)
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <Stack gap="sm">
        <form.Field name="serialNumber">
          {(f) => <TextInput label="序列号" required value={f.state.value} onChange={(e) => f.handleChange(e.currentTarget.value)} />}
        </form.Field>
        <form.Field name="deviceType">
          {(f) => <Select label="类型" data={deviceTypeOptions} value={f.state.value} onChange={(v) => f.handleChange(v ?? 'generic')} />}
        </form.Field>
        <form.Field name="patientId">
          {(f) => <Select label="患者" data={patientOptions} value={f.state.value ?? ''} onChange={(v) => f.handleChange(v ?? '')} />}
        </form.Field>
        <form.Field name="status">
          {(f) => <Select label="状态" data={statusOptions} value={f.state.value} onChange={(v) => f.handleChange(v ?? 'active')} />}
        </form.Field>
        <Button type="submit" fullWidth loading={updateMutation.isPending}>保存</Button>
      </Stack>
    </form>
  )
}