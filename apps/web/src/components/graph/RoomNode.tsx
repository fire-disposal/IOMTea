import React, { memo, useCallback, useState } from 'react'
import { Badge, Group, Paper, Text, ThemeIcon } from '@mantine/core'
import { IconBuildingStore, IconBed, IconSofa, IconToolsKitchen2, IconBath, IconBooks, IconArrowGuide, IconDoor, IconTrees, IconBox, IconFridge } from '@tabler/icons-react'

export interface RoomData {
  label: string
  roomType: string
  patientName?: string
  patientId?: string
  deviceCount: number
  subNodes: { id: string; label?: string; deviceType?: string; status?: string }[]
  onNodeDrop?: (itemId: string, itemType: string, roomId: string) => void
  selected?: boolean
}

interface RoomNodeProps {
  id: string
  data: RoomData
  onClick?: (id: string) => void
  onContextMenu?: (e: React.MouseEvent, id: string) => void
}

const roomIcons: Record<string, React.ReactNode> = {
  bedroom: <IconBed size={16} />,
  livingroom: <IconSofa size={16} />,
  kitchen: <IconToolsKitchen2 size={16} />,
  bathroom: <IconBath size={16} />,
  study: <IconBooks size={16} />,
  corridor: <IconArrowGuide size={16} />,
  entry: <IconDoor size={16} />,
  balcony: <IconTrees size={16} />,
  storage: <IconBox size={16} />,
  dining: <IconFridge size={16} />,
}

const roomColors: Record<string, string> = {
  bedroom: 'matchaGreen', livingroom: 'blue', kitchen: 'orange',
  bathroom: 'cyan', study: 'violet', corridor: 'gray',
  entry: 'teal', balcony: 'lime', storage: 'gray', dining: 'pink',
}

export const RoomNode = memo<RoomNodeProps>(({ id, data, onClick, onContextMenu }) => {
  const roomType = data.roomType ?? 'bedroom'
  const icon = roomIcons[roomType] ?? <IconBuildingStore size={16} />
  const color = roomColors[roomType] ?? 'gray'
  const [dragOver, setDragOver] = useState(false)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const raw = e.dataTransfer.getData('application/node-panel')
    if (!raw) return
    const { id: itemId, type } = JSON.parse(raw)
    data.onNodeDrop?.(itemId, type, id)
  }, [data, id])

  return (
    <Paper
      p="sm"
      radius="md"
      withBorder
      shadow={data.selected ? 'md' : 'sm'}
      style={{
        borderColor: dragOver ? 'var(--mantine-color-matchaGreen-5)'
          : data.selected ? `var(--mantine-color-${color}-5)` : undefined,
        borderWidth: dragOver || data.selected ? 2 : 1,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        opacity: dragOver ? 0.95 : 1,
      }}
      onClick={() => onClick?.(id)}
      onContextMenu={(e) => onContextMenu?.(e, id)}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <Group gap="xs" mb={4}>
        <ThemeIcon size="sm" color={color} variant="light" radius="md">{icon}</ThemeIcon>
        <Text size="sm" fw={600}>{data.label}</Text>
      </Group>
      <Group gap={4}>
        {data.deviceCount > 0 && <Badge size="xs" variant="light" color={color}>{data.deviceCount} 设备</Badge>}
        {data.patientName && <Badge size="xs" variant="dot" color="matchaGreen">{data.patientName}</Badge>}
      </Group>
      {data.subNodes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {data.subNodes.slice(0, 4).map((sn) => (
            <Badge key={sn.id} size="xs" variant="light" color={sn.status === 'active' ? 'green' : 'gray'}>
              {sn.label ?? sn.id?.slice(0, 8)}
            </Badge>
          ))}
          {data.subNodes.length > 4 && (
            <Badge size="xs" variant="subtle" color="gray">+{data.subNodes.length - 4}</Badge>
          )}
        </div>
      )}
    </Paper>
  )
})

RoomNode.displayName = 'RoomNode'