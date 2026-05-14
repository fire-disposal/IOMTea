import { Group, Paper, Stack, Text, Title } from '@mantine/core'
import { useParams } from 'react-router-dom'
import { trpc } from '../trpc'
import { StateSkeleton } from '../components/shared/StateComponents'

export function PatientProfile() {
  const { id } = useParams<{ id: string }>()
  const patient = trpc.patient.byId.useQuery({ id: id! }, { enabled: !!id })

  if (patient.isLoading) return <StateSkeleton count={2} />
  if (!patient.data) return <Text c="dimmed">患者不存在</Text>

  const p = patient.data as any

  return (
    <Stack gap="md">
      <Paper p="md" radius="md">
        <Title order={4} mb="md">基本信息</Title>
        <Group gap="xl">
          <div><Text size="xs" c="dimmed">姓名</Text><Text>{p.name}</Text></div>
          <div><Text size="xs" c="dimmed">性别</Text><Text>{typeof p.gender === 'string' ? (p.gender === 'male' ? '男' : p.gender === 'female' ? '女' : '其他') : '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">出生日期</Text><Text>{p.birthDate || '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">身高</Text><Text>{p.heightCm ? `${p.heightCm} cm` : '未设置'}</Text></div>
          <div><Text size="xs" c="dimmed">体重</Text><Text>{p.weightKg ? `${p.weightKg} kg` : '未设置'}</Text></div>
        </Group>
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
    </Stack>
  )
}
