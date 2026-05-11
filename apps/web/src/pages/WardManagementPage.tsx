import { useState } from 'react'
import { Container, Title, Paper, Text, Group, Button, Badge, Stack, Modal, TextInput, NumberInput, MultiSelect, Loader } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { trpc } from '../trpc'
import { useWardStore } from '../store/ward'

const PROFILE_OPTIONS = [
  { value: 'elderly-cardiac', label: '老年心脏' },
  { value: 'post-surgery', label: '术后监护' },
  { value: 'diabetes', label: '糖尿病' },
  { value: 'copd-respiratory', label: '慢阻肺' },
  { value: 'maternity', label: '孕产监护' },
]

export function WardManagementPage() {
  const utils = trpc.useUtils()
  const setSelectedWard = useWardStore((s) => s.setSelectedWard)
  const selectedWardId = useWardStore((s) => s.selectedWardId)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newProfiles, setNewProfiles] = useState<string[]>(['elderly-cardiac'])
  const [newSpeed, setNewSpeed] = useState(1)

  const wardsQuery = trpc.simulator.status.useQuery()
  const wards = (Array.isArray(wardsQuery.data) ? wardsQuery.data : wardsQuery.data ? [wardsQuery.data] : []) as any[]

  const createWard = trpc.simulator.createWard.useMutation({
    onSuccess: () => {
      notifications.show({ title: '已创建', message: `Ward "${newName}" 已启动`, color: 'green' })
      setCreateOpen(false)
      setNewName('')
      utils.simulator.status.invalidate()
    },
    onError: (err: any) => notifications.show({ title: '创建失败', message: err.message, color: 'red' }),
  })

  const pauseWard = trpc.simulator.pause.useMutation({
    onSuccess: () => utils.simulator.status.invalidate(),
  })

  const resumeWard = trpc.simulator.resume.useMutation({
    onSuccess: () => utils.simulator.status.invalidate(),
  })

  const deleteWard = trpc.simulator.delete.useMutation({
    onSuccess: () => {
      notifications.show({ title: '已删除', message: 'Ward 已移除', color: 'orange' })
      utils.simulator.status.invalidate()
    },
    onError: (err: any) => notifications.show({ title: '删除失败', message: err.message, color: 'red' }),
  })

  const setSpeed = trpc.simulator.setSpeed.useMutation({
    onSuccess: () => utils.simulator.status.invalidate(),
  })

  const handleCreate = () => {
    if (!newName.trim()) return
    createWard.mutate({
      name: newName.trim(),
      patients: newProfiles.map((p) => ({ profileId: p, count: 1 })),
      speed: newSpeed,
    })
  }

  return (
    <Container size="md" py="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>Ward 管理</Title>
        <Button size="sm" onClick={() => setCreateOpen(true)}>创建 Ward</Button>
      </Group>

      {wardsQuery.isLoading && (
        <Paper p="xl" withBorder><Loader /></Paper>
      )}

      {wards.length === 0 && !wardsQuery.isLoading && (
        <Paper p="xl" withBorder ta="center">
          <Text c="dimmed">暂无 Ward。请创建一个新的虚拟监护空间。</Text>
        </Paper>
      )}

      <Stack gap="sm">
        {wards.map((w: any) => {
          const isSelected = w.id === selectedWardId
          return (
            <Paper key={w.id} p="md" withBorder style={{ borderColor: isSelected ? '#228be6' : undefined, borderWidth: isSelected ? 2 : 1 }}>
            <Group justify="space-between" wrap="wrap">
              <Group gap="sm">
                <Text fw={600}>{w.name}</Text>
                {isSelected && <Badge color="blue" size="xs">当前</Badge>}
                <Badge color={w.running ? 'green' : 'gray'} variant="filled" size="sm">
                  {w.running ? '运行中' : '已暂停'}
                </Badge>
                <Badge color="blue" variant="light" size="sm">{w.speed}×</Badge>
                <Text size="xs" c="dimmed">患者 {w.patientCount} 人 · tick {w.tick}</Text>
              </Group>

              <Group gap="xs">
                {!isSelected && (
                  <Button size="xs" variant="light" onClick={() => setSelectedWard(w.id, w.name)}>
                    选择
                  </Button>
                )}
                {w.running ? (
                  <Button size="xs" variant="light" color="orange" loading={pauseWard.isPending}
                    onClick={() => pauseWard.mutate({ wardId: w.id })}>
                    暂停
                  </Button>
                ) : (
                  <Button size="xs" variant="light" color="green" loading={resumeWard.isPending}
                    onClick={() => resumeWard.mutate({ wardId: w.id })}>
                    恢复
                  </Button>
                )}
                <NumberInput
                  size="xs"
                  value={w.speed}
                  onChange={(v) => { const n = typeof v === 'string' ? parseFloat(v) : (v ?? 1); setSpeed.mutate({ wardId: w.id, speed: n }) }}
                  min={0.1} max={60} step={1}
                  style={{ width: 70 }}
                  disabled={setSpeed.isPending}
                />
                <Button size="xs" variant="light" color="red"
                  loading={deleteWard.isPending}
                  onClick={() => { if (confirm(`删除 "${w.name}"?`)) deleteWard.mutate({ wardId: w.id }) }}>
                  删除
                </Button>
              </Group>
            </Group>
          </Paper>
          )
        })}
      </Stack>

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="创建新 Ward" size="sm">
        <Stack gap="sm">
          <TextInput label="Ward 名称" value={newName} onChange={(e) => setNewName(e.currentTarget.value)}
            placeholder="例如: ICU 观察病房" data-autofocus />
          <MultiSelect label="患者画像" data={PROFILE_OPTIONS} value={newProfiles} onChange={setNewProfiles}
            placeholder="选择至少一个画像" />
          <NumberInput label="仿真速度" value={newSpeed} onChange={(v) => setNewSpeed(typeof v === 'string' ? parseFloat(v) : (v ?? 1))}
            min={0.1} max={60} step={0.5} />
          <Button onClick={handleCreate} loading={createWard.isPending}>
            创建并启动
          </Button>
        </Stack>
      </Modal>
    </Container>
  )
}
