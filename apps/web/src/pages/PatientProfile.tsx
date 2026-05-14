import { Badge, Button, Group, NumberInput, Paper, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { trpc } from '../trpc'
import { StateSkeleton } from '../components/shared/StateComponents'

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
  const { id } = useParams<{ id: string }>()
  const [editing, setEditing] = useState(false)
  const utils = trpc.useUtils()

  const patient = trpc.patient.byId.useQuery({ id: id! }, { enabled: !!id })
  const devices = trpc.device.list.useQuery({ patientId: id! }, { enabled: !!id })

  const updateMutation = trpc.patient.update.useMutation({
    onSuccess: () => {
      utils.patient.byId.invalidate({ id: id! })
      setEditing(false)
      notifications.show({ title: '保存成功', message: '', color: 'green' })
    },
  })

  const form = useForm({
    initialValues: {
      name: '',
      gender: '',
      birthDate: '',
      heightCm: undefined as number | undefined,
      weightKg: undefined as number | undefined,
      bloodType: '',
      phone: '',
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
    },
  })

  const startEdit = () => {
    const p = patient.data as any
    form.setValues({
      name: p.name || '',
      gender: p.gender || '',
      birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
      heightCm: p.heightCm ?? undefined,
      weightKg: p.weightKg ?? undefined,
      bloodType: p.bloodType || '',
      phone: p.phone || '',
      address: p.address || '',
      emergencyContact: p.emergencyContact || '',
      emergencyPhone: p.emergencyPhone || '',
    })
    setEditing(true)
  }

  const save = () => {
    updateMutation.mutate({ id: id!, ...form.values } as any)
  }

  if (patient.isLoading) return <StateSkeleton count={2} />
  if (!patient.data) return <Text c="dimmed">患者不存在</Text>

  const p = patient.data as any

  if (editing) {
    return (
      <Stack gap="md">
        <Paper p="md" radius="md">
          <Title order={4} mb="md">编辑信息</Title>
          <form onSubmit={form.onSubmit(save)}>
            <Stack gap="md">
              <Group gap="md">
                <TextInput label="姓名" required {...form.getInputProps('name')} />
                <Select label="性别" data={genderOptions} {...form.getInputProps('gender')} />
                <TextInput label="出生日期" type="date" {...form.getInputProps('birthDate')} />
              </Group>
              <Group gap="md">
                <NumberInput label="身高 (cm)" min={0} {...form.getInputProps('heightCm')} />
                <NumberInput label="体重 (kg)" min={0} {...form.getInputProps('weightKg')} />
                <Select label="血型" data={bloodTypeOptions} {...form.getInputProps('bloodType')} />
              </Group>
              <Group gap="md">
                <TextInput label="电话" {...form.getInputProps('phone')} />
                <TextInput label="地址" {...form.getInputProps('address')} />
              </Group>
              <Group gap="md">
                <TextInput label="紧急联系人" {...form.getInputProps('emergencyContact')} />
                <TextInput label="紧急电话" {...form.getInputProps('emergencyPhone')} />
              </Group>
              <Group>
                <Button type="submit" loading={updateMutation.isPending}>保存</Button>
                <Button variant="subtle" onClick={() => setEditing(false)}>取消</Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <Paper p="md" radius="md">
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

      <Paper p="md" radius="md">
        <Title order={4} mb="md">联系信息</Title>
        <Group gap="xl">
          <div><Text size="xs" c="dimmed">电话</Text><Text>{p.phone || '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">地址</Text><Text>{p.address || '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">紧急联系人</Text><Text>{p.emergencyContact || '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">紧急电话</Text><Text>{p.emergencyPhone || '未设置'}</Text></div>
        </Group>
      </Paper>

      <Paper p="md" radius="md">
        <Title order={4} mb="md">病史</Title>
        <Group>
          {p.tags?.conditions?.map((c: string) => <Badge key={c} color="matchaGreen">{c}</Badge>)}
          {(!p.tags?.conditions || p.tags.conditions.length === 0) && <Text c="dimmed">无记录</Text>}
        </Group>
      </Paper>

      <Paper p="md" radius="md">
        <Title order={4} mb="md">关联设备</Title>
        {devices.isLoading ? (
          <StateSkeleton count={1} />
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>序列号</Table.Th>
                <Table.Th>类型</Table.Th>
                <Table.Th>状态</Table.Th>
                <Table.Th>最后在线</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {devices.data?.map((d: any) => (
                <Table.Tr key={d.id}>
                  <Table.Td>{d.serialNumber}</Table.Td>
                  <Table.Td><Badge variant="light">{d.deviceType}</Badge></Table.Td>
                  <Table.Td><Badge color={d.status === 'active' ? 'green' : 'gray'}>{d.status}</Badge></Table.Td>
                  <Table.Td>{d.lastSeen ? new Date(d.lastSeen).toLocaleString() : '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  )
}
