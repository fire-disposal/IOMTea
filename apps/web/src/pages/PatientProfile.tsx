import { Badge, Button, Group, Modal, NumberInput, Paper, Select, Skeleton, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useParams, useNavigate } from '@tanstack/react-router'
import { trpc } from '../trpc'

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
]
const bloodTypeOptions = ['A', 'B', 'AB', 'O']

function genderLabel(g: string) {
  if (g === 'male') return '男'
  if (g === 'female') return '女'
  if (g === 'other') return '其他'
  return '未设置'
}

export function PatientProfile() {
  const { id } = (useParams as any)({ from: '/_auth/patients/$id' })
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [editKey, setEditKey] = useState(0)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const utils = trpc.useUtils()

  const patient = trpc.patient.byId.useQuery({ id: id! }, { enabled: !!id })
  const pins = trpc.pin.list.useQuery(undefined, { enabled: !!id })

  const updateMutation = trpc.patient.update.useMutation({
    onSuccess: () => {
      utils.patient.byId.invalidate({ id: id! })
      setEditing(false)
      notifications.show({ title: '保存成功', message: '', color: 'green' })
    },
  })

  const deleteMutation = trpc.patient.delete.useMutation({
    onSuccess: () => {
      notifications.show({ title: '成功', message: '患者已删除', color: 'green' })
      navigate({ to: '/patients' })
    },
    onError: (err) => notifications.show({ title: '失败', message: err.message, color: 'red' }),
  })

  const startEdit = () => { setEditKey((k) => k + 1); setEditing(true) }

  if (patient.isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={28} width={200} />
        <Skeleton height={120} />
        <Skeleton height={120} />
      </Stack>
    )
  }

  if (!patient.data) return <Text c="dimmed">患者不存在</Text>

  const p = patient.data as any

  if (editing) {
    return <EditPatientForm key={editKey} patient={p} updateMutation={updateMutation} onCancel={() => setEditing(false)} patientId={id!} utils={utils} />
  }

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button size="sm" color="red" variant="light" onClick={() => setDeleteConfirm(true)}>删除患者</Button>
      </Group>

      <Paper p="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={4}>基本信息</Title>
          <Button size="sm" variant="light" onClick={startEdit}>编辑</Button>
        </Group>
        <Group gap="xl">
          <div><Text size="xs" c="dimmed">姓名</Text><Text>{p.name}</Text></div>
          <div><Text size="xs" c="dimmed">性别</Text><Text>{genderLabel(p.gender)}</Text></div>
          <div><Text size="xs" c="dimmed">出生日期</Text><Text>{p.birthDate || '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">身高</Text><Text>{p.heightCm ? `${p.heightCm} cm` : '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">体重</Text><Text>{p.weightKg ? `${p.weightKg} kg` : '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">血型</Text><Text>{p.bloodType || '未设置'}</Text></div>
        </Group>
        <Text size="xs" c="dimmed" mt="xs">主治医生ID: {p.primaryDoctorId || '未设置'}</Text>
      </Paper>

      <Paper p="lg" radius="md" withBorder>
        <Title order={4} mb="md">联系信息</Title>
        <Group gap="xl">
          <div><Text size="xs" c="dimmed">电话</Text><Text>{p.phone || '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">地址</Text><Text>{p.address || '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">紧急联系人</Text><Text>{p.emergencyContact || '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">紧急电话</Text><Text>{p.emergencyPhone || '未设置'}</Text></div>
        </Group>
      </Paper>

      <Paper p="lg" radius="md" withBorder>
        <Title order={4} mb="md">病史</Title>
        <Group>
          {p.tags?.conditions?.map((c: string) => <Badge key={c} color="matchaGreen">{c}</Badge>)}
          {(!p.tags?.conditions || p.tags.conditions.length === 0) && <Text c="dimmed">无记录</Text>}
        </Group>
      </Paper>

      <Paper p="lg" radius="md" withBorder>
        <Title order={4} mb="md">关联设备</Title>
        {pins.isLoading ? (
          <Skeleton height={100} />
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>PIN</Table.Th><Table.Th>类型</Table.Th><Table.Th>标签</Table.Th><Table.Th>最后活跃</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {pins.data?.map((d: any) => (
                <Table.Tr key={d.pin}><Table.Td><Text ff="monospace" size="sm">{d.pin}</Text></Table.Td><Table.Td><Badge variant="light">{d.type}</Badge></Table.Td><Table.Td>{d.label || '-'}</Table.Td><Table.Td>{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '—'}</Table.Td></Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal opened={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="确认删除" size="sm">
        <Text mb="lg">确定要删除此患者吗？此操作不可撤销。</Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setDeleteConfirm(false)}>取消</Button>
          <Button color="red" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate({ id: id! })}>确认删除</Button>
        </Group>
      </Modal>
    </Stack>
  )
}

function EditPatientForm({ patient, updateMutation, onCancel, patientId, utils }: { patient: any; updateMutation: any; onCancel: () => void; patientId: string; utils: any }) {
  const form = useForm({
    defaultValues: {
      name: patient.name || '',
      gender: patient.gender || '',
      birthDate: patient.birthDate ? patient.birthDate.slice(0, 10) : '',
      heightCm: patient.heightCm ?? undefined as number | undefined,
      weightKg: patient.weightKg ?? undefined as number | undefined,
      bloodType: patient.bloodType || '',
      phone: patient.phone || '',
      address: patient.address || '',
      emergencyContact: patient.emergencyContact || '',
      emergencyPhone: patient.emergencyPhone || '',
    },
    onSubmit: ({ value }) => {
      const clean = Object.fromEntries(Object.entries(value).filter(([_, v]) => v !== '' && v !== undefined && v !== null))
      updateMutation.mutate({ id: patientId, data: clean } as any)
    },
  })

  return (
    <Paper p="lg" radius="md" withBorder>
      <Title order={4} mb="md">编辑信息</Title>
      <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
        <Stack gap="md">
          <Group gap="md">
            <FormField form={form} name="name" label="姓名" required />
            <SelectField form={form} name="gender" label="性别" data={genderOptions} />
            <FormField form={form} name="birthDate" label="出生日期" type="date" />
          </Group>
          <Group gap="md">
            <NumberField form={form} name="heightCm" label="身高 (cm)" min={0} />
            <NumberField form={form} name="weightKg" label="体重 (kg)" min={0} />
            <SelectField form={form} name="bloodType" label="血型" data={bloodTypeOptions} />
          </Group>
          <Group gap="md">
            <FormField form={form} name="phone" label="电话" />
            <FormField form={form} name="address" label="地址" />
          </Group>
          <Group gap="md">
            <FormField form={form} name="emergencyContact" label="紧急联系人" />
            <FormField form={form} name="emergencyPhone" label="紧急电话" />
          </Group>
          <Group>
            <Button type="submit" loading={updateMutation.isPending}>保存</Button>
            <Button variant="subtle" onClick={onCancel}>取消</Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  )
}

function FormField({ form, name, label, required, type }: { form: any; name: string; label: string; required?: boolean; type?: string }) {
  return (
    <form.Field name={name}>
      {(f: any) => <TextInput label={label} required={required} type={type} value={f.state.value ?? ''} onChange={(e: any) => f.handleChange(e.currentTarget.value)} />}
    </form.Field>
  )
}

function SelectField({ form, name, label, data }: { form: any; name: string; label: string; data: { value: string; label: string }[] | string[] }) {
  const options = typeof data[0] === 'string' ? data.map((v) => ({ value: v as string, label: v as string })) : data as { value: string; label: string }[]
  return (
    <form.Field name={name}>
      {(f: any) => <Select label={label} data={options} value={f.state.value ?? ''} onChange={(v: any) => f.handleChange(v ?? '')} />}
    </form.Field>
  )
}

function NumberField({ form, name, label, min }: { form: any; name: string; label: string; min?: number }) {
  return (
    <form.Field name={name}>
      {(f: any) => <NumberInput label={label} min={min} value={f.state.value ?? ''} onChange={(v: any) => f.handleChange(typeof v === 'number' ? v : undefined)} />}
    </form.Field>
  )
}