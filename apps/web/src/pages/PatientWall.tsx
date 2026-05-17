import {
  ActionIcon,
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconAlertTriangle,
  IconDevices,
  IconPlus,
  IconSearch,
  IconUsers,
  IconX,
} from '@tabler/icons-react'
import { useState } from 'react'
import { PatientCard } from '../components/patients/PatientCard'
import { StateEmpty, StateError, StateSkeleton } from '../components/shared/StateComponents'
import { StatsBar, type StatsBarItem } from '../components/shared/StatsBar'
import { trpc } from '../trpc'

export function PatientWall() {
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const utils = trpc.useUtils()

  const patients = trpc.patient.list.useQuery({ pageSize: 100, status: 'active' })
  const alerts = trpc.alert.list.useQuery({ pageSize: 100 }, { refetchInterval: 30000 })
  const createPatient = trpc.patient.create.useMutation({
    onSuccess: () => {
      notifications.show({ title: '成功', message: '患者已创建', color: 'green' })
      setCreateOpen(false)
      form.reset()
      utils.patient.list.invalidate()
    },
    onError: (err) => notifications.show({ title: '失败', message: err.message, color: 'red' }),
  })

  const deletePatient = trpc.patient.delete.useMutation({
    onSuccess: () => {
      notifications.show({ title: '成功', message: '患者已删除', color: 'green' })
      setDeleteTarget(null)
      utils.patient.list.invalidate()
    },
    onError: (err) => notifications.show({ title: '失败', message: err.message, color: 'red' }),
  })

  const form = useForm({
    initialValues: {
      name: '',
      gender: '',
      birthDate: '',
      heightCm: undefined as number | undefined,
      weightKg: undefined as number | undefined,
      phone: '',
      address: '',
    },
    validate: { name: (v) => (!v ? '请输入姓名' : null) },
  })

  const filtered = (patients.data || []).filter(
    (p: any) => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  )

  const statsItems: StatsBarItem[] = [
    {
      label: '患者总数',
      value: patients.data?.length ?? 0,
      icon: <IconUsers size={20} />,
      color: 'matchaGreen',
    },
    {
      label: '活跃告警',
      value: alerts.data?.filter((a: any) => a.status === 'active').length ?? 0,
      icon: <IconAlertTriangle size={20} />,
      color: 'red',
    },
  ]

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>患者监护</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
          添加患者
        </Button>
      </Group>

      <StatsBar items={statsItems} />

      <TextInput
        placeholder="搜索患者..."
        leftSection={<IconSearch size={16} />}
        rightSection={
          search ? (
            <ActionIcon size="sm" variant="subtle" onClick={() => setSearch('')}>
              <IconX size={14} />
            </ActionIcon>
          ) : undefined
        }
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="xl"
      />

      {patients.isLoading && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          <StateSkeleton count={6} />
        </SimpleGrid>
      )}
      {patients.isError && <StateError message="加载患者列表失败" />}
      {!patients.isLoading && !patients.isError && filtered.length === 0 && (
        <StateEmpty
          message="暂无患者"
          action={() => setCreateOpen(true)}
          actionLabel="添加第一位患者"
        />
      )}
      {!patients.isLoading && !patients.isError && filtered.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {filtered.map((p: any) => (
            <PatientCard
              key={p.id}
              patient={p}
              alertCount={
                alerts.data?.filter((a: any) => a.patientId === p.id && a.status === 'active')
                  .length
              }
              onDelete={(id) => setDeleteTarget(id)}
            />
          ))}
        </SimpleGrid>
      )}

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="添加患者" size="md">
        <form
          onSubmit={form.onSubmit((v) => {
            const clean = Object.fromEntries(
              Object.entries(v).filter(
                ([_, val]) => val !== '' && val !== undefined && val !== null,
              ),
            )
            createPatient.mutate(clean as any)
          })}
        >
          <Stack>
            <SimpleGrid cols={2}>
              <TextInput label="姓名" required {...form.getInputProps('name')} />
              <Select
                label="性别"
                data={[
                  { value: 'male', label: '男' },
                  { value: 'female', label: '女' },
                  { value: 'other', label: '其他' },
                ]}
                {...form.getInputProps('gender')}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <TextInput label="出生日期" type="date" {...form.getInputProps('birthDate')} />
              <NumberInput
                label="身高 (cm)"
                min={0}
                max={250}
                {...form.getInputProps('heightCm')}
              />
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <NumberInput
                label="体重 (kg)"
                min={0}
                max={300}
                {...form.getInputProps('weightKg')}
              />
              <TextInput label="电话" {...form.getInputProps('phone')} />
            </SimpleGrid>
            <TextInput label="地址" {...form.getInputProps('address')} />
            <Button type="submit" loading={createPatient.isPending} fullWidth mt="md">
              创建患者
            </Button>
          </Stack>
        </form>
      </Modal>
      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
        size="sm"
      >
        <Text mb="lg">确定要删除此患者吗？此操作不可撤销。</Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setDeleteTarget(null)}>
            取消
          </Button>
          <Button
            color="red"
            loading={deletePatient.isPending}
            onClick={() => deletePatient.mutate({ id: deleteTarget! })}
          >
            确认删除
          </Button>
        </Group>
      </Modal>
    </Container>
  )
}
