import { useState } from 'react'
import { Container, Title, Group, Table, Badge, Button, Modal, TextInput, ActionIcon, Tooltip, Text, Stack, ScrollArea } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconEdit, IconRefresh, IconTrash } from '@tabler/icons-react'
import { trpc } from '../trpc'
import { StateSkeleton, StateEmpty, StateError } from '../components/shared/StateComponents'

export function PinManagementPage() {
  const { data: pins, refetch, isLoading, isError } = trpc.pin.list.useQuery()
  const createMutation = trpc.pin.create.useMutation()
  const updateMutation = trpc.pin.update.useMutation()
  const resetMutation = trpc.pin.reset.useMutation()
  const deleteMutation = trpc.pin.delete.useMutation()
  const { data: users } = trpc.user.list.useQuery({ page: 1, pageSize: 100 })

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [newPin, setNewPin] = useState({ userId: '', label: '', nickname: '' })
  const [editingPin, setEditingPin] = useState<any>(null)

  const handleCreate = async () => {
    if (!newPin.userId) return
    await createMutation.mutateAsync({
      userId: newPin.userId,
      label: newPin.label || undefined,
      nickname: newPin.nickname || undefined,
    })
    setNewPin({ userId: '', label: '', nickname: '' })
    closeCreate()
    refetch()
  }

  const handleUpdate = async () => {
    if (!editingPin) return
    await updateMutation.mutateAsync({
      pin: editingPin.pin,
      label: editingPin.label,
      nickname: editingPin.nickname,
    })
    setEditingPin(null)
    closeEdit()
    refetch()
  }

  const handleReset = async (oldPin: string) => {
    await resetMutation.mutateAsync({ oldPin })
    refetch()
  }

  const handleDelete = async (pin: string) => {
    await deleteMutation.mutateAsync({ pin })
    refetch()
  }

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>PIN 管理</Title>
        <Button onClick={openCreate}>生成新 PIN</Button>
      </Group>

      {isLoading && <StateSkeleton variant="table" count={5} />}
      {isError && <StateError message="加载 PIN 列表失败" onRetry={refetch} />}
      {!isLoading && !isError && (!pins || pins.length === 0) && <StateEmpty message="暂无 PIN" action={openCreate} actionLabel="生成新 PIN" />}
      {!isLoading && !isError && pins && pins.length > 0 && (
      <ScrollArea>
        <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>PIN</Table.Th>
            <Table.Th>用户</Table.Th>
            <Table.Th>标签</Table.Th>
            <Table.Th>昵称</Table.Th>
            <Table.Th>关联物体</Table.Th>
            <Table.Th>最后在线</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {pins?.map(p => (
            <Table.Tr key={p.pin}>
              <Table.Td><Badge variant="light">{p.pin}</Badge></Table.Td>
              <Table.Td>{users?.find(u => u.id === p.userId)?.displayName || p.userId.slice(0, 8)}</Table.Td>
              <Table.Td>{p.label || '-'}</Table.Td>
              <Table.Td>{p.nickname || '-'}</Table.Td>
              <Table.Td>{p.thingId ? p.thingId.slice(0, 8) : '-'}</Table.Td>
              <Table.Td>
                {p.lastSeenAt ? (
                  <Badge variant="light" color={Date.now() - new Date(p.lastSeenAt).getTime() < 86400000 ? 'green' : 'gray'}>
                    {new Date(p.lastSeenAt).toLocaleString()}
                  </Badge>
                ) : (
                  <Badge variant="light" color="gray">从未</Badge>
                )}
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Tooltip label="编辑">
                    <ActionIcon variant="light" onClick={() => { setEditingPin(p); openEdit() }}>
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="重置">
                    <ActionIcon variant="light" color="orange" onClick={() => handleReset(p.pin)}>
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="删除">
                    <ActionIcon variant="light" color="red" onClick={() => handleDelete(p.pin)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
        </Table>
      </ScrollArea>
      )}

      <Modal opened={createOpened} onClose={closeCreate} title="生成新 PIN">
        <Stack>
          <TextInput
            label="选择用户"
            placeholder="用户ID"
            value={newPin.userId}
            onChange={e => setNewPin(p => ({ ...p, userId: e.target.value }))}
          />
          <TextInput
            label="标签（管理用）"
            placeholder="如：张-主卧-床垫"
            value={newPin.label}
            onChange={e => setNewPin(p => ({ ...p, label: e.target.value }))}
          />
          <TextInput
            label="昵称（用户端显示）"
            placeholder="如：我的床垫"
            value={newPin.nickname}
            onChange={e => setNewPin(p => ({ ...p, nickname: e.target.value }))}
          />
          <Button onClick={handleCreate} loading={createMutation.isPending}>生成</Button>
        </Stack>
      </Modal>

      <Modal opened={editOpened} onClose={closeEdit} title="编辑 PIN">
        <Stack>
          <Text size="sm">PIN: {editingPin?.pin}</Text>
          <TextInput
            label="标签"
            value={editingPin?.label || ''}
            onChange={e => setEditingPin((p: any) => ({ ...p, label: e.target.value }))}
          />
          <TextInput
            label="昵称"
            value={editingPin?.nickname || ''}
            onChange={e => setEditingPin((p: any) => ({ ...p, nickname: e.target.value }))}
          />
          <Button onClick={handleUpdate} loading={updateMutation.isPending}>保存</Button>
        </Stack>
      </Modal>
    </Container>
  )
}
