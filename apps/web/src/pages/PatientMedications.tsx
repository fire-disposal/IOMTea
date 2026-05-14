import { ActionIcon, Badge, Button, Card, Center, Group, Loader, Modal, Paper, Select, Stack, Table, Text, Textarea, TextInput, Title, Alert } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { trpc } from '../trpc'
import { StateEmpty } from '../components/shared/StateComponents'

const routeLabels: Record<string, string> = { oral: '口服', injection: '注射', topical: '外用', inhalation: '吸入', other: '其他' }
const statusColor: Record<string, string> = { active: 'green', completed: 'blue', paused: 'orange', cancelled: 'gray' }
const statusLabels: Record<string, string> = { active: '使用中', completed: '已完成', paused: '暂停', cancelled: '取消' }
const dosageUnits = ['片', '粒', 'ml', 'mg', 'g', '滴']
const frequencies = ['每日一次', '每日两次', '每日三次', '每日四次', '睡前', '按需']

function getNextDose(schedules: any[] | undefined): { time: string; minutesUntil: number } | null {
  if (!schedules || schedules.length === 0) return null
  const now = new Date()
  let best: { time: string; minutesUntil: number } | null = null

  for (const s of schedules) {
    const [h, m] = s.scheduledTime.split(':').map(Number)
    const doseDate = new Date()
    doseDate.setHours(h, m, 0, 0)

    if (s.dayOfWeek && s.dayOfWeek.length > 0) {
      const currentDow = now.getDay() || 7
      const sortedDays = [...s.dayOfWeek].sort((a: number, b: number) => a - b)
      let target = sortedDays.find((d: number) => d >= currentDow)
      if (target === undefined) target = sortedDays[0]
      let daysUntil = target - currentDow
      if (daysUntil < 0) daysUntil += 7
      doseDate.setDate(now.getDate() + daysUntil)
      if (daysUntil === 0 && doseDate <= now) {
        doseDate.setDate(doseDate.getDate() + 7)
      }
    } else {
      if (doseDate <= now) doseDate.setDate(doseDate.getDate() + 1)
    }

    const diff = Math.round((doseDate.getTime() - now.getTime()) / 60000)
    if (!best || diff < best.minutesUntil) {
      best = { time: s.scheduledTime, minutesUntil: diff }
    }
  }
  return best
}

export function PatientMedications() {
  const { id } = useParams<{ id: string }>()
  const patientId = id!

  const [createOpen, setCreateOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null)

  const utils = trpc.useUtils()

  const meds = trpc.medication.list.useQuery({ patientId }, { enabled: !!patientId })

  const schedulesQueries = trpc.useQueries((t) =>
    meds.data?.map((m: any) => t.medication.schedules({ medicationId: m.id })) ?? []
  )

  const selectedSchedules = trpc.medication.schedules.useQuery(
    { medicationId: selectedMedId ?? '' },
    { enabled: !!selectedMedId }
  )

  const adherenceQueries = trpc.useQueries((t) =>
    selectedSchedules.data?.map((s: any) => t.medication.adherence({ scheduleId: s.id })) ?? []
  )

  const create = trpc.medication.create.useMutation({
    onSuccess: () => {
      utils.medication.list.invalidate()
      setCreateOpen(false)
      form.reset()
      notifications.show({ title: '已添加', message: '用药记录已创建', color: 'green' })
    },
  })

  const update = trpc.medication.update.useMutation({
    onSuccess: () => {
      utils.medication.list.invalidate()
      setEditingId(null)
      setCreateOpen(false)
      form.reset()
      notifications.show({ title: '已更新', message: '用药记录已更新', color: 'blue' })
    },
  })

  const del = trpc.medication.delete.useMutation({
    onSuccess: () => {
      utils.medication.list.invalidate()
      setDeleteConfirm(null)
      notifications.show({ title: '已删除', message: '', color: 'orange' })
    },
  })

  const markTaken = trpc.medication.markTaken.useMutation({
    onSuccess: () => {
      utils.medication.adherence.invalidate()
      notifications.show({ title: '已服用', message: '服药记录已保存', color: 'green' })
    },
  })

  const form = useForm({
    initialValues: {
      drugName: '',
      dosage: '',
      dosageUnit: '片',
      frequency: '每日一次',
      route: 'oral',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      instructions: '',
    },
    validate: {
      drugName: (v: string) => (v.trim() ? null : '药品名为必填项'),
      dosage: (v: string) => (v.trim() ? null : '剂量为必填项'),
    },
  })

  const handleSubmit = (values: typeof form.values) => {
    const data = {
      ...values,
      endDate: values.endDate || undefined,
      instructions: values.instructions || undefined,
    }
    if (editingId) {
      update.mutate({ id: editingId, ...data } as any)
    } else {
      create.mutate({ patientId, ...data } as any)
    }
  }

  const openEdit = (med: any) => {
    setEditingId(med.id)
    form.setValues({
      drugName: med.drugName,
      dosage: med.dosage,
      dosageUnit: med.dosageUnit,
      frequency: med.frequency,
      route: med.route,
      startDate: med.startDate || new Date().toISOString().slice(0, 10),
      endDate: med.endDate || '',
      instructions: med.instructions || '',
    })
    setCreateOpen(true)
  }

  const handleMarkTaken = (schedules: any[]) => {
    const today = new Date().toISOString().slice(0, 10)
    for (const s of schedules) {
      markTaken.mutate({ scheduleId: s.id, dueDate: today, dueTime: s.scheduledTime })
    }
  }

  const formatMinutesUntil = (minutes: number) => {
    if (minutes >= 1440) {
      const days = Math.floor(minutes / 1440)
      const remainMin = minutes % 1440
      const hours = Math.floor(remainMin / 60)
      const mins = remainMin % 60
      if (hours === 0 && mins === 0) return `${days}天后`
      if (mins === 0) return `${days}天${hours}小时后`
      return `${days}天${hours}小时${mins}分钟后`
    }
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      if (mins === 0) return `${hours}小时后`
      return `${hours}小时${mins}分钟后`
    }
    return `${minutes}分钟后`
  }

  if (!patientId) return null

  if (meds.isLoading) {
    return (
      <Center py="xl">
        <Group>
          <Loader size="sm" />
          <Text c="dimmed">加载中...</Text>
        </Group>
      </Center>
    )
  }

  if (meds.isError) {
    return (
      <Center py="xl">
        <Alert color="red" title="加载失败">{meds.error?.message || '请检查网络连接'}</Alert>
      </Center>
    )
  }

  const medications = meds.data || []

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>用药管理</Title>
        <Button
          size="sm"
          onClick={() => {
            setEditingId(null)
            form.reset()
            setCreateOpen(true)
          }}
        >
          添加用药
        </Button>
      </Group>

      {medications.length === 0 ? (
        <StateEmpty message="暂无用药记录" />
      ) : (
        <Paper p="md" radius="md" withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>药物</Table.Th>
                <Table.Th>剂量</Table.Th>
                <Table.Th>频率</Table.Th>
                <Table.Th>途径</Table.Th>
                <Table.Th>开始日期</Table.Th>
                <Table.Th>下次用药</Table.Th>
                <Table.Th>状态</Table.Th>
                <Table.Th>操作</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {medications.map((m: any, idx: number) => {
                const schedData = schedulesQueries[idx]?.data
                const nextDose = getNextDose(schedData)

                return (
                  <Table.Tr key={m.id}>
                    <Table.Td>
                      <Text fw={500}>{m.drugName}</Text>
                    </Table.Td>
                    <Table.Td>
                      {m.dosage}
                      {m.dosageUnit}
                    </Table.Td>
                    <Table.Td>{m.frequency}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="xs">
                        {routeLabels[m.route] || m.route}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{m.startDate}</Table.Td>
                    <Table.Td>
                      {nextDose ? (
                        <Text size="xs" c="blue">
                          下次: {nextDose.time}（{formatMinutesUntil(nextDose.minutesUntil)}）
                        </Text>
                      ) : (
                        <Text size="xs" c="dimmed">
                          无排程
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColor[m.status] || 'gray'} variant="filled">
                        {statusLabels[m.status] || m.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {m.status === 'active' && schedData && schedData.length > 0 && (
                          <Button
                            size="xs"
                            variant="light"
                            color="green"
                            onClick={() => handleMarkTaken(schedData)}
                            loading={markTaken.isPending}
                          >
                            已服用
                          </Button>
                        )}
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          aria-label="查看依从性"
                          onClick={() =>
                            setSelectedMedId(selectedMedId === m.id ? null : m.id)
                          }
                        >
                          📊
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          aria-label="编辑"
                          onClick={() => openEdit(m)}
                        >
                          ✏️
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          aria-label="删除"
                          onClick={() => setDeleteConfirm(m.id)}
                        >
                          🗑
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {selectedMedId && (
        <Card mt="md" p="md" radius="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Text fw={500}>服药依从性</Text>
            <ActionIcon variant="subtle" onClick={() => setSelectedMedId(null)}>
              ✕
            </ActionIcon>
          </Group>
          {selectedSchedules.isLoading ? (
            <Center py="md">
              <Loader size="sm" />
            </Center>
          ) : !selectedSchedules.data || selectedSchedules.data.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              暂无排程数据
            </Text>
          ) : (
            <Stack gap="lg">
              {selectedSchedules.data.map((s: any, schedIdx: number) => {
                const adhData = adherenceQueries[schedIdx]?.data
                return (
                  <div key={s.id}>
                    <Text size="sm" fw={500} mb={4}>
                      ⏰ {s.scheduledTime}
                      {s.dayOfWeek && s.dayOfWeek.length > 0
                        ? `（周${s.dayOfWeek.join('、')}）`
                        : '（每日）'}
                    </Text>
                    {adherenceQueries[schedIdx]?.isLoading ? (
                      <Center py="xs">
                        <Loader size="xs" />
                      </Center>
                    ) : !adhData || adhData.length === 0 ? (
                      <Text size="xs" c="dimmed" ta="center" py="xs">
                        暂无服药记录
                      </Text>
                    ) : (
                      <Stack gap={4}>
                        {adhData.map((a: any) => (
                          <Group key={a.id} justify="space-between">
                            <Text size="xs">
                              {a.dueDate} {a.dueTime}
                            </Text>
                            <Badge
                              size="xs"
                              color={
                                a.adherenceStatus === 'taken'
                                  ? 'green'
                                  : a.adherenceStatus === 'missed'
                                    ? 'red'
                                    : 'gray'
                              }
                              variant="light"
                            >
                              {a.adherenceStatus === 'taken'
                                ? '已服用'
                                : a.adherenceStatus === 'missed'
                                  ? '未服用'
                                  : '未知'}
                            </Badge>
                          </Group>
                        ))}
                      </Stack>
                    )}
                  </div>
                )
              })}
            </Stack>
          )}
        </Card>
      )}

      <Modal
        opened={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setEditingId(null)
          form.reset()
        }}
        title={editingId ? '编辑用药' : '添加用药'}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="sm">
            <TextInput label="药品名" required {...form.getInputProps('drugName')} />
            <Group grow>
              <TextInput label="剂量" required {...form.getInputProps('dosage')} />
              <Select label="单位" data={dosageUnits} {...form.getInputProps('dosageUnit')} />
            </Group>
            <Select label="频率" data={frequencies} {...form.getInputProps('frequency')} />
            <Select
              label="途径"
              data={Object.entries(routeLabels).map(([k, v]) => ({ value: k, label: v }))}
              {...form.getInputProps('route')}
            />
            <TextInput label="开始日期" type="date" {...form.getInputProps('startDate')} />
            <TextInput label="结束日期（可选）" type="date" {...form.getInputProps('endDate')} />
            <Textarea label="用药说明（可选）" {...form.getInputProps('instructions')} />
            <Button type="submit" fullWidth loading={create.isPending || update.isPending}>
              {editingId ? '更新' : '创建'}
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除"
        size="sm"
      >
        <Text mb="lg">确定要删除此用药记录吗？此操作不可撤销。</Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>
            取消
          </Button>
          <Button
            color="red"
            loading={del.isPending}
            onClick={() => del.mutate({ id: deleteConfirm! })}
          >
            删除
          </Button>
        </Group>
      </Modal>
    </>
  )
}
