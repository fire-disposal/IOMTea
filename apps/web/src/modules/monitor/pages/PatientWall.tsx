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
  IconUsers,
  IconX,
} from '@tabler/icons-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm } from '@tanstack/react-form'
import { PatientCard } from '../../../components/patients/PatientCard'
import { StateEmpty, StateError, StateSkeleton } from '../../../components/shared/StateComponents'
import { StatsBar, type StatsBarItem } from '../../../components/shared/StatsBar'
import { api } from '../../../api/client'

export function PatientWall() {
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [patients, setPatients] = useState<any[]>([])
  const [pLoading, setPLoading] = useState(true)
  const [pError, setPError] = useState(false)
  const [alerts, setAlerts] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [filterTagIds, setFilterTagIds] = useState<string[]>([])
  const [createLoading, setCreateLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const alertIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const fetchPatients = useCallback(async () => {
    setPLoading(true)
    try {
      const data = await api.get<any[]>('/patients', { pageSize: 100, status: 'active' })
      setPatients(data)
      setPError(false)
    } catch {
      setPError(true)
    } finally {
      setPLoading(false)
    }
  }, [])

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.get<any[]>('/alerts', { pageSize: 100 })
      setAlerts(data)
    } catch { /* silent */ }
  }, [])

  const fetchTags = useCallback(async () => {
    try {
      const data = await api.get<any[]>('/tags')
      setTags(data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchPatients(); fetchAlerts(); fetchTags() }, [fetchPatients, fetchAlerts, fetchTags])
  useEffect(() => {
    alertIntervalRef.current = setInterval(fetchAlerts, 30000)
    return () => clearInterval(alertIntervalRef.current)
  }, [fetchAlerts])

  const handleCreate = async (value: any) => {
    setCreateLoading(true)
    try {
      await api.post('/patients', value)
      notifications.show({ title: '成功', message: '患者已创建', color: 'green' })
      setCreateOpen(false)
      form.reset()
      fetchPatients()
    } catch (err: any) {
      notifications.show({ title: '失败', message: err.message, color: 'red' })
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/patients/${deleteTarget}`)
      notifications.show({ title: '成功', message: '患者已删除', color: 'green' })
      setDeleteTarget(null)
      fetchPatients()
    } catch (err: any) {
      notifications.show({ title: '失败', message: err.message, color: 'red' })
    } finally {
      setDeleteLoading(false)
    }
  }

  const form = useForm({
    defaultValues: {
      name: '',
      gender: '',
      birthDate: '',
      heightCm: undefined as number | undefined,
      weightKg: undefined as number | undefined,
      phone: '',
      address: '',
    },
    onSubmit: ({ value }) => {
      const clean = Object.fromEntries(
        Object.entries(value).filter(([_, val]) => val !== '' && val !== undefined && val !== null),
      )
      handleCreate(clean)
    },
  })

  const nameRequired = ({ value }: { value: unknown }) => (!value ? '请输入姓名' : undefined)

  const filtered = patients.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (
      filterTagIds.length > 0 &&
      (!p.tagIds || !filterTagIds.some((tid: string) => p.tagIds.includes(tid)))
    )
      return false
    return true
  })

  const statsItems: StatsBarItem[] = [
    {
      label: '患者总数',
      value: patients.length,
      icon: <IconUsers size={20} />,
      color: 'matchaGreen',
    },
    {
      label: '活跃告警',
      value: alerts.filter((a: any) => a.status === 'active').length,
      icon: <IconAlertTriangle size={20} />,
      color: 'red',
    },
  ]

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>患者监护</Title>
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
            添加患者
          </Button>
        </Group>
      </Group>

      <StatsBar items={statsItems} loading={pLoading} />

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
                <Chip
                  key={tag.id}
                  value={tag.id}
                  color={tag.color?.replace('#', '') || 'teal'}
                  variant="light"
                  size="xs"
                >
                  {tag.name}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Box>
      )}

      {pLoading && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          <StateSkeleton count={6} />
        </SimpleGrid>
      )}
      {pError && <StateError message="加载患者列表失败" />}
      {!pLoading && !pError && filtered.length === 0 && (
        <StateEmpty
          message="暂无患者"
          action={() => setCreateOpen(true)}
          actionLabel="添加第一位患者"
        />
      )}
      {!pLoading && !pError && filtered.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {filtered.map((p: any, index: number) => (
            <div
              key={p.id}
              className="anim-stagger-item"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <PatientCard
                patient={p}
                alertCount={
                  alerts.filter((a: any) => a.patientId === p.id && a.status === 'active')
                    .length
                }
                onDelete={(id) => setDeleteTarget(id)}
              />
            </div>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="添加患者" size="md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <Stack>
            <SimpleGrid cols={2}>
              <form.Field name="name" validators={{ onChange: nameRequired }}>
                {(field) => (
                  <TextInput
                    label="姓名"
                    required
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                    error={field.state.meta.errors?.[0]}
                  />
                )}
              </form.Field>
              <form.Field name="gender">
                {(field) => (
                  <Select
                    label="性别"
                    data={[
                      { value: 'male', label: '男' },
                      { value: 'female', label: '女' },
                      { value: 'other', label: '其他' },
                    ]}
                    value={field.state.value ?? ''}
                    onChange={(v) => field.handleChange(v ?? '')}
                  />
                )}
              </form.Field>
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <form.Field name="birthDate">
                {(field) => (
                  <TextInput
                    label="出生日期"
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                  />
                )}
              </form.Field>
              <form.Field name="heightCm">
                {(field) => (
                  <NumberInput
                    label="身高 (cm)"
                    min={0}
                    max={250}
                    value={field.state.value ?? ''}
                    onChange={(v) => field.handleChange(typeof v === 'number' ? v : undefined)}
                  />
                )}
              </form.Field>
            </SimpleGrid>
            <SimpleGrid cols={2}>
              <form.Field name="weightKg">
                {(field) => (
                  <NumberInput
                    label="体重 (kg)"
                    min={0}
                    max={300}
                    value={field.state.value ?? ''}
                    onChange={(v) => field.handleChange(typeof v === 'number' ? v : undefined)}
                  />
                )}
              </form.Field>
              <form.Field name="phone">
                {(field) => (
                  <TextInput
                    label="电话"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                  />
                )}
              </form.Field>
            </SimpleGrid>
            <form.Field name="address">
              {(field) => (
                <TextInput
                  label="地址"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                />
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  loading={isSubmitting || createLoading}
                  fullWidth
                  mt="md"
                >
                  创建患者
                </Button>
              )}
            </form.Subscribe>
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
            loading={deleteLoading}
            onClick={handleDelete}
          >
            确认删除
          </Button>
        </Group>
      </Modal>
    </Container>
  )
}
