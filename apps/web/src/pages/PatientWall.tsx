import {
  ActionIcon,
  Box,
  Button,
  Chip,
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
import { notifications } from '@mantine/notifications'
import {
  IconAlertTriangle,
  IconPlus,
  IconSearch,
  IconUpload,
  IconUsers,
  IconX,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { PatientCard } from '../components/patients/PatientCard'
import { PatientImport } from './PatientImport'
import { StateEmpty, StateError, StateSkeleton } from '../components/shared/StateComponents'
import { StatsBar, type StatsBarItem } from '../components/shared/StatsBar'
import { trpc } from '../trpc'

export function PatientWall() {
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const utils = trpc.useUtils()

  const patients = trpc.patient.list.useQuery({ pageSize: 100, status: 'active' })
  const alerts = trpc.alert.list.useQuery({ pageSize: 100 }, { refetchInterval: 30000 })
  const { data: tags } = trpc.tag.list.useQuery()
  const [filterTagIds, setFilterTagIds] = useState<string[]>([])
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
    defaultValues: { name: '', gender: '', birthDate: '', heightCm: undefined as number | undefined, weightKg: undefined as number | undefined, phone: '', address: '' },
    onSubmit: ({ value }) => {
      const clean = Object.fromEntries(
        Object.entries(value).filter(([_, val]) => val !== '' && val !== undefined && val !== null),
      )
      createPatient.mutate(clean as any)
    },
  })

  const nameRequired = ({ value }: { value: unknown }) => (!value ? '请输入姓名' : undefined)

  const filtered = (patients.data || []).filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTagIds.length > 0 && (!p.tagIds || !filterTagIds.some((tid: string) => p.tagIds.includes(tid)))) return false
    return true
  })

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
        <Group>
          <Button leftSection={<IconUpload size={16} />} variant="light" onClick={() => setImportOpen(true)}>
            批量导入
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
            添加患者
          </Button>
        </Group>
      </Group>

      <StatsBar items={statsItems} loading={patients.isLoading} />

      <TextInput
        placeholder="搜索患者..."
        leftSection={<IconSearch size={16} />}
        rightSection={
          search ? (
            <ActionIcon size="sm" variant="light" color="gray" onClick={() => setSearch('')}>
              <IconX size={14} />
            </ActionIcon>
          ) : undefined
        }
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="xl"
      />

      {tags && tags.length > 0 && (
        <Box mb="md">
        <Chip.Group multiple value={filterTagIds} onChange={setFilterTagIds}>
          <Group gap="xs">
            {tags.map((tag: any) => (
              <Chip key={tag.id} value={tag.id} color={tag.color?.replace('#', '') || 'teal'} variant="light" size="xs">
                {tag.name}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
        </Box>
      )}

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
          {filtered.map((p: any, index: number) => (
            <div key={p.id} className="anim-stagger-item" style={{ animationDelay: `${index * 60}ms` }}>
              <PatientCard
                patient={p}
                alertCount={
                  alerts.data?.filter((a: any) => a.patientId === p.id && a.status === 'active')
                    .length
                }
                onDelete={(id) => setDeleteTarget(id)}
              />
            </div>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="添加患者" size="md">
        <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
          <Stack>
            <SimpleGrid cols={2}>
              <form.Field name="name" validators={{ onChange: nameRequired }}>
                {(field) => (
                  <TextInput label="姓名" required value={field.state.value} onChange={(e) => field.handleChange(e.currentTarget.value)} error={field.state.meta.errors?.[0]} />
                )}
              </form.Field>
              <form.Field name="gender">
                {(field) => (
                  <Select label="性别" data={[{ value: 'male', label: '男' }, { value: 'female', label: '女' }, { value: 'other', label: '其他' }]} value={field.state.value ?? ''} onChange={(v) => field.handleChange(v ?? '')} />
                )}
              </form.Field>
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <form.Field name="birthDate">
                {(field) => (
                  <TextInput label="出生日期" type="date" value={field.state.value} onChange={(e) => field.handleChange(e.currentTarget.value)} />
                )}
              </form.Field>
              <form.Field name="heightCm">
                {(field) => (
                  <NumberInput label="身高 (cm)" min={0} max={250} value={field.state.value ?? ''} onChange={(v) => field.handleChange(typeof v === 'number' ? v : undefined)} />
                )}
              </form.Field>
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <form.Field name="weightKg">
                {(field) => (
                  <NumberInput label="体重 (kg)" min={0} max={300} value={field.state.value ?? ''} onChange={(v) => field.handleChange(typeof v === 'number' ? v : undefined)} />
                )}
              </form.Field>
              <form.Field name="phone">
                {(field) => (
                  <TextInput label="电话" value={field.state.value} onChange={(e) => field.handleChange(e.currentTarget.value)} />
                )}
              </form.Field>
            </SimpleGrid>
            <form.Field name="address">
              {(field) => (
                <TextInput label="地址" value={field.state.value} onChange={(e) => field.handleChange(e.currentTarget.value)} />
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" loading={isSubmitting || createPatient.isPending} fullWidth mt="md">创建患者</Button>
              )}
            </form.Subscribe>
          </Stack>
        </form>
      </Modal>
      <PatientImport opened={importOpen} onClose={() => setImportOpen(false)} onImported={() => utils.patient.list.invalidate()} />
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
