import React, { useCallback, useMemo, useState, useRef } from 'react'
import { Box, Button, Group, Modal, Select, Stack, TextInput, LoadingOverlay } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconZoomIn, IconZoomOut, IconArrowsMaximize, IconLayoutGrid } from '@tabler/icons-react'
import { trpc } from '../trpc'
import { RoomNode, type RoomData } from '../components/graph/RoomNode'
import { NodePanel } from '../components/graph/NodePanel'

const roomTypeOptions = [
  { value: 'bedroom', label: '卧室' },
  { value: 'livingroom', label: '客厅' },
  { value: 'kitchen', label: '厨房' },
  { value: 'bathroom', label: '卫生间' },
  { value: 'study', label: '书房' },
  { value: 'corridor', label: '走廊' },
  { value: 'entry', label: '玄关' },
  { value: 'balcony', label: '阳台' },
  { value: 'storage', label: '储物间' },
  { value: 'dining', label: '餐厅' },
]

interface RoomModel {
  id: string
  name: string
  type: string
  x: number
  y: number
  connections: string[]
  patientId?: string
  patientName?: string
  devices: {
    id: string
    label?: string
    serialNumber?: string
    pin?: string
    deviceType?: string
    status?: string
  }[]
}

interface GraphItem {
  id: string
  label: string
  deviceType?: string
  status?: string
  latestVitals?: { metric: string; value: number; unit: string }[]
}

export function NodeGraphPage() {
  const utils = trpc.useUtils()
  const { data: graphData, isLoading } = trpc.nodeGraph.getGraph.useQuery()
  const saveGraph = trpc.nodeGraph.saveGraph.useMutation({
    onSuccess: () =>
      notifications.show({ title: '已保存', message: '图谱布局已保存', color: 'green' }),
    onError: (e) => notifications.show({ title: '保存失败', message: e.message, color: 'red' }),
  })
  const assignDevice = trpc.nodeGraph.assignDevice.useMutation()
  const deleteRoom = trpc.nodeGraph.deleteRoom.useMutation({
    onSuccess: () => notifications.show({ title: '已删除', message: '', color: 'orange' }),
  })

  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [editingRoom, setEditingRoom] = useState<{ id: string; name: string; type: string } | null>(
    null,
  )
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomType, setNewRoomType] = useState('bedroom')
  const [searchText, setSearchText] = useState('')
  const [scale, setScale] = useState(1)

  const rooms: RoomModel[] = useMemo(() => (graphData?.rooms ?? []) as RoomModel[], [graphData])

  const handleNodeDrop = useCallback(
    (itemId: string, itemType: string, roomId: string) => {
      if (itemType === 'device') {
        assignDevice.mutate({ deviceId: itemId, roomId })
        utils.nodeGraph.getGraph.invalidate()
      }
    },
    [assignDevice, utils],
  )

  const handleCreateRoom = useCallback(() => {
    const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    rooms.push({
      id,
      name: newRoomName || '新房间',
      type: newRoomType,
      x: 0,
      y: 0,
      connections: [],
      devices: [],
    })
    setCreatingRoom(false)
    setNewRoomName('')
    setNewRoomType('bedroom')
  }, [rooms, newRoomName, newRoomType])

  const handleDeleteRoom = useCallback(
    (roomId: string) => {
      deleteRoom.mutate({ roomId })
    },
    [deleteRoom],
  )

  const handleEditSave = useCallback(() => {
    if (!editingRoom) return
    const room = rooms.find((r) => r.id === editingRoom.id)
    if (room) {
      room.name = editingRoom.name
      room.type = editingRoom.type
    }
    setEditingRoom(null)
  }, [editingRoom, rooms])

  const handleSaveGraph = useCallback(() => {
    saveGraph.mutate({
      graph: {
        rooms: rooms.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          x: r.x,
          y: r.y,
          connections: r.connections,
          patientId: r.patientId,
        })),
      },
    } as any)
  }, [rooms, saveGraph])

  const unassignedDevices: GraphItem[] = useMemo(
    () =>
      (graphData?.unassignedDevices ?? []).map((d: any) => ({
        id: d.id,
        label: d.label ?? d.serialNumber ?? d.id,
        deviceType: d.deviceType,
        status: d.status,
      })),
    [graphData],
  )

  const unassignedPatients: GraphItem[] = useMemo(
    () =>
      (graphData?.patients ?? []).map((p: any) => ({
        id: p.id,
        label: p.name,
        latestVitals: p.latestVitals,
      })),
    [graphData],
  )

  if (isLoading) {
    return (
      <Box
        style={{
          height: 'calc(100vh - 112px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LoadingOverlay visible />
      </Box>
    )
  }

  return (
    <Box style={{ height: 'calc(100vh - 112px)', display: 'flex', position: 'relative' }}>
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: '#f8faf9',
          overflow: 'auto',
        }}
      >
        <Box
          p="sm"
          style={{
            borderBottom: '1px solid var(--mantine-color-gray-2)',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconArrowsMaximize size={14} />}
              onClick={() => setScale((s) => Math.min(s + 0.1, 2))}
            >
              放大
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconZoomOut size={14} />}
              onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
            >
              缩小
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconLayoutGrid size={14} />}
              onClick={() => setScale(1)}
            >
              重置
            </Button>
          </Group>
          <Box style={{ flex: 1 }} />
          <TextInput
            size="xs"
            placeholder="搜索房间..."
            value={searchText}
            onChange={(e) => setSearchText(e.currentTarget.value)}
          />
          <Button
            size="xs"
            variant="filled"
            onClick={handleSaveGraph}
            loading={saveGraph.isPending}
          >
            保存布局
          </Button>
        </Box>

        <Box
          p="md"
          style={{
            flex: 1,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
            alignContent: 'start',
            transition: 'transform 0.15s',
          }}
        >
          {rooms
            .filter((r) => !searchText || r.name.toLowerCase().includes(searchText.toLowerCase()))
            .map((room) => (
              <Box key={room.id} style={{ position: 'relative' }}>
                <RoomNode
                  id={room.id}
                  data={{
                    label: room.name || room.id.slice(0, 8),
                    roomType: room.type ?? 'bedroom',
                    patientName: room.patientName,
                    patientId: room.patientId,
                    deviceCount: room.devices?.length ?? 0,
                    subNodes: (room.devices ?? []).map((d) => ({
                      id: d.id ?? '',
                      label: d.label ?? d.serialNumber ?? d.pin ?? d.id,
                      deviceType: d.deviceType,
                      status: d.status,
                    })),
                    onNodeDrop: handleNodeDrop,
                    selected: selectedRoom === room.id,
                  }}
                  onClick={(id) => setSelectedRoom(id === selectedRoom ? null : id)}
                  onContextMenu={(e, id) => {
                    e.preventDefault()
                    setSelectedRoom(id)
                  }}
                />
                {selectedRoom === room.id && (
                  <Group
                    gap={4}
                    mt={4}
                    style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10 }}
                  >
                    <Button
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={() =>
                        setEditingRoom({ id: room.id, name: room.name, type: room.type })
                      }
                    >
                      编辑
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={() => handleDeleteRoom(room.id)}
                    >
                      删除
                    </Button>
                  </Group>
                )}
              </Box>
            ))}
        </Box>
      </Box>

      <Box
        style={{ width: 240, flexShrink: 0, borderLeft: '1px solid var(--mantine-color-gray-2)' }}
      >
        <NodePanel
          devices={unassignedDevices}
          patients={unassignedPatients}
          onCreateRoom={() => {
            setNewRoomName('')
            setNewRoomType('bedroom')
            setCreatingRoom(true)
          }}
        />
      </Box>

      <Modal
        opened={creatingRoom}
        onClose={() => setCreatingRoom(false)}
        title="创建房间"
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="房间名称"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.currentTarget.value)}
            placeholder="例如：主卧"
          />
          <Select
            label="房间类型"
            data={roomTypeOptions}
            value={newRoomType}
            onChange={(v) => setNewRoomType(v ?? 'bedroom')}
          />
          <Button onClick={handleCreateRoom}>创建</Button>
        </Stack>
      </Modal>

      <Modal opened={!!editingRoom} onClose={() => setEditingRoom(null)} title="编辑房间" size="sm">
        <Stack gap="sm">
          <TextInput
            label="房间名称"
            value={editingRoom?.name ?? ''}
            onChange={(e) =>
              setEditingRoom((prev) => (prev ? { ...prev, name: e.currentTarget.value } : null))
            }
          />
          <Select
            label="房间类型"
            data={roomTypeOptions}
            value={editingRoom?.type ?? 'bedroom'}
            onChange={(v) =>
              setEditingRoom((prev) => (prev ? { ...prev, type: v ?? 'bedroom' } : null))
            }
          />
          <Button onClick={handleEditSave}>保存</Button>
        </Stack>
      </Modal>
    </Box>
  )
}
