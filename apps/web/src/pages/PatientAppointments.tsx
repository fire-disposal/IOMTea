import { ActionIcon, Badge, Button, Group, Modal, NumberInput, Paper, Select, Stack, Table, Tabs, Text, TextInput, Textarea } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconCalendar, IconTrash } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { trpc } from '../trpc'
import { StateEmpty } from '../components/shared/StateComponents'

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'blue', confirmed: 'green', in_progress: 'yellow',
  completed: 'gray', cancelled: 'red', no_show: 'orange',
}

const APPOINTMENT_TYPES = [
  { value: 'checkup', label: '常规检查' },
  { value: 'followup', label: '随访' },
  { value: 'emergency', label: '急诊' },
  { value: 'consultation', label: '咨询' },
  { value: 'rehabilitation', label: '康复' },
]

const FOLLOWUP_LABELS: Record<string, string> = {
  phone: '电话', video: '视频', home_visit: '家访', clinic: '门诊', message: '消息',
}

export function PatientAppointments() {
  const { id } = useParams<{ id: string }>()
  const [createOpen, setCreateOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const utils = trpc.useUtils()

  const appts = trpc.appointment.list.useQuery({ patientId: id! }, { enabled: !!id })
  const followups = trpc.appointment.followups.useQuery({ patientId: id! }, { enabled: !!id })

  const create = trpc.appointment.create.useMutation({
    onSuccess: () => {
      utils.appointment.list.invalidate()
      setCreateOpen(false)
      form.reset()
      notifications.show({ title: '预约已创建', message: '', color: 'green' })
    },
  })

  const cancel = trpc.appointment.cancel.useMutation({
    onSuccess: () => {
      utils.appointment.list.invalidate()
      setCancelTarget(null)
      notifications.show({ title: '预约已取消', message: '', color: 'orange' })
    },
  })

  const form = useForm({
    initialValues: {
      appointmentType: 'checkup',
      scheduledAt: '',
      durationMinutes: 30,
      location: '居家',
      reason: '',
      notes: '',
    },
  })

  const upcoming = useMemo(() => {
    const now = new Date()
    if (!appts.data) return null
    const future = appts.data
      .filter((a: any) => new Date(a.scheduledAt) > now && (a.status === 'scheduled' || a.status === 'confirmed'))
      .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    return future[0] || null
  }, [appts.data])

  const daysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now()
    return Math.ceil(diff / 86400000)
  }

  const canCancel = (status: string) => status === 'scheduled' || status === 'confirmed'

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button size="sm" onClick={() => { form.reset(); setCreateOpen(true) }}>新建预约</Button>
      </Group>

      {upcoming && (
        <Paper p="md" radius="md" bg="matchaGreen.0" mb="md">
          <Group>
            <IconCalendar size={24} color="var(--mantine-color-matchaGreen-6)" />
            <div>
              <Text fw={600}>下次预约</Text>
              <Text>{new Date(upcoming.scheduledAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · {APPOINTMENT_TYPES.find(t => t.value === upcoming.appointmentType)?.label || upcoming.appointmentType} · {upcoming.location}</Text>
              <Text size="sm" c="dimmed">{daysUntil(upcoming.scheduledAt)}天后</Text>
            </div>
          </Group>
        </Paper>
      )}

      <Tabs defaultValue="appointments">
        <Tabs.List mb="md">
          <Tabs.Tab value="appointments">预约列表</Tabs.Tab>
          <Tabs.Tab value="followups">随访记录</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="appointments">
          {!appts.data || appts.data.length === 0 ? (
            <StateEmpty message="暂无预约记录" />
          ) : (
            <Paper p="md" radius="md">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>类型</Table.Th>
                    <Table.Th>时间</Table.Th>
                    <Table.Th>地点</Table.Th>
                    <Table.Th>状态</Table.Th>
                    <Table.Th>原因</Table.Th>
                    <Table.Th>操作</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {appts.data.map((a: any) => (
                    <Table.Tr key={a.id}>
                      <Table.Td>{APPOINTMENT_TYPES.find(t => t.value === a.appointmentType)?.label || a.appointmentType}</Table.Td>
                      <Table.Td>{new Date(a.scheduledAt).toLocaleString('zh-CN')}</Table.Td>
                      <Table.Td>{a.location}</Table.Td>
                      <Table.Td><Badge color={STATUS_COLORS[a.status] || 'gray'} size="sm">{a.status}</Badge></Table.Td>
                      <Table.Td>{a.reason || '—'}</Table.Td>
                      <Table.Td>
                        {canCancel(a.status) && (
                          <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setCancelTarget(a.id)}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="followups">
          {!followups.data || followups.data.length === 0 ? (
            <StateEmpty message="暂无随访记录" />
          ) : (
            <Paper p="md" radius="md">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>类型</Table.Th>
                    <Table.Th>日期</Table.Th>
                    <Table.Th>摘要</Table.Th>
                    <Table.Th>评估</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {followups.data.map((f: any) => (
                    <Table.Tr key={f.id}>
                      <Table.Td><Badge size="sm" variant="light">{FOLLOWUP_LABELS[f.type] || f.type}</Badge></Table.Td>
                      <Table.Td>{new Date(f.conductedAt).toLocaleDateString('zh-CN')}</Table.Td>
                      <Table.Td>{f.summary || '—'}</Table.Td>
                      <Table.Td>{f.assessment || '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="新建预约">
        <form onSubmit={form.onSubmit((vals) => create.mutate({ patientId: id!, ...vals } as any))}>
          <Stack gap="sm">
            <Select
              label="预约类型"
              required
              data={APPOINTMENT_TYPES}
              {...form.getInputProps('appointmentType')}
            />
            <TextInput
              label="预约时间"
              required
              type="datetime-local"
              {...form.getInputProps('scheduledAt')}
            />
            <NumberInput
              label="时长（分钟）"
              min={5}
              max={480}
              {...form.getInputProps('durationMinutes')}
            />
            <Select
              label="地点"
              data={['居家', '线上', 'XX医院']}
              {...form.getInputProps('location')}
            />
            <TextInput
              label="原因"
              {...form.getInputProps('reason')}
            />
            <Textarea
              label="备注"
              {...form.getInputProps('notes')}
            />
            <Button type="submit" fullWidth loading={create.isPending}>创建</Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!cancelTarget} onClose={() => setCancelTarget(null)} title="取消预约" size="sm">
        <Text mb="lg">确定要取消此预约吗？</Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setCancelTarget(null)}>返回</Button>
          <Button color="red" loading={cancel.isPending} onClick={() => cancel.mutate({ id: cancelTarget! })}>确认取消</Button>
        </Group>
      </Modal>
    </>
  )
}
