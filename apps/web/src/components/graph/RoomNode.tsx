import React, { memo, useCallback, useState } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Badge, Group, Paper, Text, ThemeIcon } from '@mantine/core'
import { IconBuildingStore, IconBed, IconSofa, IconToolsKitchen2, IconBath, IconBooks, IconArrowGuide, IconDoor, IconTrees, IconBox, IconFridge } from '@tabler/icons-react'

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
  bedroom: 'matchaGreen',
  livingroom: 'blue',
  kitchen: 'orange',
  bathroom: 'cyan',
  study: 'violet',
  corridor: 'gray',
  entry: 'teal',
  balcony: 'lime',
  storage: 'gray',
  dining: 'pink',
}

const roomLabels: Record<string, string> = {
  bedroom: '卧室',
  livingroom: '客厅',
  kitchen: '厨房',
  bathroom: '卫生间',
  study: '书房',
  corridor: '走廊',
  entry: '玄关',
  balcony: '阳台',
  storage: '储物间',
  dining: '餐厅',
}

export const RoomNode: React.FC<NodeProps> = memo(({ id, data, selected }) => {
  const roomType = (data.roomType as string) ?? 'bedroom'
  const icon = roomIcons[roomType] ?? <IconBuildingStore size={16} />
  const color = roomColors[roomType] ?? 'gray'
  const label = roomLabels[roomType] ?? roomType
  const deviceCount = (data.deviceCount as number) ?? 0
  const patientName = data.patientName as string | undefined
  const [dragOver, setDragOver] = useState(false)

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const rawData = e.dataTransfer.getData('application/node-panel')
    if (!rawData) return
    const { id: itemId, type } = JSON.parse(rawData)
    const handler = data.onNodeDrop as ((itemId: string, itemType: string, roomId: string) => void) | undefined
    if (handler) handler(itemId, type, id)
  }, [data, id])

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: 'var(--mantine-color-matchaGreen-5)', border: 'none', width: 10, height: 10 }} />
      <Paper
        p="sm"
        radius="md"
        withBorder
        shadow={selected ? 'md' : 'sm'}
        style={{
          borderColor: dragOver ? 'var(--mantine-color-matchaGreen-5)' : selected ? `var(--mantine-color-${color}-5)` : undefined,
          borderWidth: dragOver ? 2 : (selected ? 2 : 1),
          minWidth: 160,
          cursor: 'pointer',
          transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
          opacity: dragOver ? 0.95 : 1,
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <Group gap="xs" mb={4}>
          <ThemeIcon size="sm" color={color} variant="light" radius="md">{icon}</ThemeIcon>
          <Text size="sm" fw={600}>{(data.label as string) ?? label}</Text>
        </Group>
        <Group gap={4}>
          {deviceCount > 0 && <Badge size="xs" variant="light" color={color}>{deviceCount} 设备</Badge>}
          {patientName && <Badge size="xs" variant="dot" color="matchaGreen">{patientName}</Badge>}
        </Group>
        <div style={{ marginTop: 6 }}>
          {(data.subNodes as any[])?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(data.subNodes as any[]).slice(0, 4).map((sn: any) => (
                <Badge key={sn.id} size="xs" variant="light" color={sn.status === 'active' ? 'green' : 'gray'}>
                  {sn.label ?? sn.id?.slice(0, 8)}
                </Badge>
              ))}
              {(data.subNodes as any[])?.length > 4 && (
                <Badge size="xs" variant="subtle" color="gray">+{(data.subNodes as any[]).length - 4}</Badge>
              )}
            </div>
          )}
        </div>
      </Paper>
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--mantine-color-matchaGreen-5)', border: 'none', width: 10, height: 10 }} />
    </>
  )
})
