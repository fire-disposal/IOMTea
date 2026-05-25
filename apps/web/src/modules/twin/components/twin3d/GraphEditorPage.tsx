import { useState, useCallback, useEffect } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconTrash, IconLink } from '@tabler/icons-react'
import { trpc } from '../../../../trpc'

const ROOM_TYPES = [
  { value: 'livingroom', label: '客厅' },
  { value: 'bedroom', label: '卧室' },
  { value: 'kitchen', label: '厨房' },
  { value: 'bathroom', label: '浴室' },
  { value: 'study', label: '书房' },
  { value: 'entry', label: '玄关' },
  { value: 'corridor', label: '走廊' },
  { value: 'balcony', label: '阳台' },
  { value: 'dining', label: '餐厅' },
  { value: 'storage', label: '储物间' },
]

interface RoomNode {
  id: string
  name: string
  type: string
  x?: number
  y?: number
  connections?: string[]
  hasCamera?: boolean
}

function autoPos(index: number): { x: number; y: number } {
  const positions = [
    { x: 0, y: 0 },
    { x: 3, y: -3 },
    { x: 3, y: 3 },
    { x: -3, y: -3 },
    { x: -3, y: 3 },
    { x: 6, y: 0 },
    { x: -6, y: 0 },
    { x: 0, y: 6 },
  ]
  return positions[index % positions.length]
}

export function GraphEditorPage({ patientId }: { patientId: string }) {
  const utils = trpc.useUtils()
  const graphQuery = trpc.homeGraph.get.useQuery({ patientId }, { enabled: !!patientId })
  const upsert = trpc.homeGraph.upsert.useMutation({
    onSuccess: () => {
      utils.homeGraph.get.invalidate({ patientId })
      notifications.show({ title: '已保存', message: '', color: 'green' })
    },
    onError: (e: any) =>
      notifications.show({ title: '保存失败', message: e.message, color: 'red' }),
  })

  const [rooms, setRooms] = useState<RoomNode[]>([])
  const [entryRoomId, setEntryRoomId] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)

  useEffect(() => {
    if (graphQuery.data) {
      setRooms(graphQuery.data.rooms)
      setEntryRoomId(graphQuery.data.entryRoomId)
    }
  }, [graphQuery.data])

  const save = () =>
    upsert.mutate({
      patientId,
      graph: {
        rooms: rooms.map((r) => ({
          ...r,
          x: r.x ?? 0,
          y: r.y ?? 0,
          connections: r.connections ?? [],
          hasCamera: r.hasCamera ?? false,
        })),
        entryRoomId,
        personLocation: null,
      } as any,
    })

  const addRoom = () => {
    const pos = autoPos(rooms.length)
    setRooms([
      ...rooms,
      {
        id: `room-${Date.now()}`,
        name: '新房间',
        type: 'bedroom',
        x: pos.x,
        y: pos.y,
        connections: [],
      },
    ])
  }

  const removeRoom = (id: string) => setRooms(rooms.filter((r) => r.id !== id))

  const updateRoom = (id: string, patch: Partial<RoomNode>) => {
    setRooms(rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const toggleConnection = (fromId: string, toId: string) => {
    setRooms(
      rooms.map((r) => {
        if (r.id === fromId) {
          const curr = r.connections ?? []
          const conns = curr.includes(toId) ? curr.filter((c) => c !== toId) : [...curr, toId]
          return { ...r, connections: conns }
        }
        return r
      }),
    )
  }

  if (graphQuery.isLoading)
    return (
      <Text c="dimmed" ta="center" py="xl">
        加载中...
      </Text>
    )

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <Group
        px="md"
        py="sm"
        bg="gray.0"
        justify="space-between"
        style={{ borderBottom: '1px solid #ddd' }}
      >
        <Text fw={600}>居家图编辑器</Text>
        <Group gap="xs">
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addRoom}>
            添加房间
          </Button>
          <Button size="xs" onClick={save} loading={upsert.isPending}>
            保存
          </Button>
        </Group>
      </Group>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {rooms.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            暂无房间，点击"添加房间"开始
          </Text>
        )}

        <Stack gap="md">
          {rooms.map((room, i) => (
            <Paper key={room.id} p="md" withBorder radius="md">
              <Group justify="space-between" mb="sm">
                <Badge>房间 {i + 1}</Badge>
                <ActionIcon color="red" variant="subtle" onClick={() => removeRoom(room.id)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
              <Group grow mb="sm">
                <TextInput
                  label="名称"
                  value={room.name}
                  onChange={(e) => updateRoom(room.id, { name: e.currentTarget.value })}
                  size="xs"
                />
                <Select
                  label="类型"
                  data={ROOM_TYPES}
                  value={room.type}
                  onChange={(v) => v && updateRoom(room.id, { type: v })}
                  size="xs"
                />
              </Group>
              <Group grow mb="sm">
                <Badge
                  size="sm"
                  color={room.hasCamera ? 'green' : 'gray'}
                  variant={room.hasCamera ? 'filled' : 'outline'}
                  style={{ cursor: 'pointer', alignSelf: 'center' }}
                  onClick={() => updateRoom(room.id, { hasCamera: !room.hasCamera })}
                >
                  {room.hasCamera ? '📷 有摄像头' : '无摄像头'}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed" mb="xs">
                连接:
              </Text>
              <Group gap="xs">
                {rooms
                  .filter((r) => r.id !== room.id)
                  .map((r) => (
                    <Badge
                      key={r.id}
                      size="sm"
                      variant={(room.connections ?? []).includes(r.id) ? 'filled' : 'outline'}
                      color={(room.connections ?? []).includes(r.id) ? 'matchaGreen' : 'gray'}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleConnection(room.id, r.id)}
                    >
                      {(room.connections ?? []).includes(r.id) ? `✓ ${r.name}` : r.name}
                    </Badge>
                  ))}
              </Group>
              <Select
                label="入口"
                data={rooms.map((r) => ({ value: r.id, label: r.name }))}
                value={entryRoomId ?? undefined}
                onChange={(v) => setEntryRoomId(v ?? null)}
                size="xs"
                mt="sm"
                clearable
                placeholder="选择入口房间"
              />
            </Paper>
          ))}
        </Stack>
      </div>
    </div>
  )
}
