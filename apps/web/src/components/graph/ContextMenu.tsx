import React, { memo } from 'react'
import { Paper, Stack, Text } from '@mantine/core'
import { IconTrash, IconLink, IconX, IconPencil } from '@tabler/icons-react'

interface ContextMenuProps {
  x: number
  y: number
  onEdit: () => void
  onConnect: () => void
  onDelete: () => void
  onClose: () => void
  roomName?: string
}

export const ContextMenu: React.FC<ContextMenuProps> = memo(
  ({ x, y, onEdit, onConnect, onDelete, onClose, roomName }) => {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 999,
          }}
          onClick={onClose}
        />
        <Paper
          shadow="lg"
          radius="md"
          p={0}
          withBorder
          style={{
            position: 'fixed',
            left: x,
            top: y,
            zIndex: 1000,
            minWidth: 160,
          }}
        >
          {roomName && (
            <Text size="xs" fw={600} px="sm" pt="sm" pb={4} c="dimmed">{roomName}</Text>
          )}
          <Stack gap={0}>
            <ContextMenuItem icon={<IconPencil size={14} />} label="编辑房间" onClick={onEdit} />
            <ContextMenuItem icon={<IconLink size={14} />} label="连接房间" onClick={onConnect} />
            <ContextMenuItem icon={<IconTrash size={14} />} label="删除房间" color="red" onClick={onDelete} />
            <ContextMenuItem icon={<IconX size={14} />} label="关闭" onClick={onClose} />
          </Stack>
        </Paper>
      </>
    )
  },
)

const ContextMenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; color?: string }> =
  ({ icon, label, onClick, color }) => (
    <div
      onClick={onClick}
      style={{
        padding: '6px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--mantine-color-gray-0)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <span style={{ color: color ? `var(--mantine-color-${color}-6)` : undefined }}>{icon}</span>
      <Text size="xs" c={color}>{label}</Text>
    </div>
  )
