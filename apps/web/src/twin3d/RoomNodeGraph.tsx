import { Badge, Paper, Text } from '@mantine/core'
import { IconCamera, IconEyeOff } from '@tabler/icons-react'
import { useMemo } from 'react'

interface RoomNode {
  id: string; name: string; type: string; x: number; y: number; connections: string[]
  hasCamera?: boolean; inferrable?: boolean
  devices?: { id: string; serialNumber: string; deviceType: string; status: string }[]
}
interface RoomState {
  roomId: string; personPresent: boolean; hasCamera: boolean; inferrable: boolean; deviceCount: number
}

const ROOM_STYLES: Record<string, { border: string; bg: string; badge: string }> = {
  bedroom: { border: '#8B6914', bg: 'linear-gradient(135deg, #fff9f0, #fff)', badge: 'orange' },
  livingroom: { border: '#6B8E23', bg: 'linear-gradient(135deg, #f4fff0, #fff)', badge: 'matchaGreen' },
  kitchen: { border: '#CD853F', bg: 'linear-gradient(135deg, #fff8f0, #fff)', badge: 'yellow' },
  bathroom: { border: '#4682B4', bg: 'linear-gradient(135deg, #f0f8ff, #fff)', badge: 'blue' },
  study: { border: '#9370DB', bg: 'linear-gradient(135deg, #f8f0ff, #fff)', badge: 'grape' },
  corridor: { border: '#B0B0B0', bg: 'linear-gradient(135deg, #fafafa, #fff)', badge: 'gray' },
  entry: { border: '#B8860B', bg: 'linear-gradient(135deg, #fffff0, #fff)', badge: 'yellow' },
  balcony: { border: '#32CD32', bg: 'linear-gradient(135deg, #f0fff0, #fff)', badge: 'green' },
  storage: { border: '#808080', bg: 'linear-gradient(135deg, #fafafa, #fff)', badge: 'gray' },
  dining: { border: '#CD5C5C', bg: 'linear-gradient(135deg, #fff5f5, #fff)', badge: 'red' },
}

const DEVICE_COLORS: Record<string, string> = {
  mattress: 'green', vision: 'blue', imu: 'violet', generic: 'gray',
  simulator: 'orange', custom: 'cyan', pin: 'matchaGreen', camera: 'red',
}

export function RoomNodeGraph({ rooms, personRoomId, roomStates }: {
  rooms: RoomNode[]; personRoomId?: string | null; roomStates?: RoomState[]
}) {
  const scale = 60

  const stateMap = useMemo(() => {
    const m = new Map<string, RoomState>()
    for (const s of roomStates ?? []) m.set(s.roomId, s)
    return m
  }, [roomStates])

  const minX = rooms.reduce((min, r) => Math.min(min, r.x), 0) - 2
  const maxX = rooms.reduce((max, r) => Math.max(max, r.x), 0) + 2
  const minY = rooms.reduce((min, r) => Math.min(min, r.y), 0) - 2
  const maxY = rooms.reduce((max, r) => Math.max(max, r.y), 0) + 2
  const w = (maxX - minX) * scale + 200
  const h = (maxY - minY) * scale + 200

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', position: 'relative', background: '#faf8f4' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: w, height: h, pointerEvents: 'none' }}>
        {rooms.map((room) =>
          room.connections.map((connId) => {
            const target = rooms.find((r) => r.id === connId)
            if (!target) return null
            const key = [room.id, connId].sort().join('-')
            const x1 = (room.x - minX) * scale + 100
            const y1 = (room.y - minY) * scale + 100
            const x2 = (target.x - minX) * scale + 100
            const y2 = (target.y - minY) * scale + 100
            return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c0b8a0" strokeWidth={2} strokeDasharray="6,4" />
          }),
        )}
      </svg>

      {rooms.map((room) => {
        const state = stateMap.get(room.id)
        const isPersonHere = personRoomId === room.id
        const style = ROOM_STYLES[room.type] || ROOM_STYLES.storage
        const hasCam = state?.hasCamera ?? room.hasCamera ?? false
        const inferrable = state?.inferrable ?? room.inferrable ?? false
        const left = (room.x - minX) * scale + 10
        const top = (room.y - minY) * scale + 10

        return (
          <div key={room.id} style={{ position: 'absolute', left, top, width: 142, transition: 'all 0.3s ease' }}>
            <Paper p="xs" radius="md" withBorder
              shadow={isPersonHere ? 'md' : 'sm'}
              style={{
                borderColor: isPersonHere ? 'var(--mantine-color-red-5)' : style.border,
                borderWidth: isPersonHere ? 2 : 1,
                background: isPersonHere ? 'var(--mantine-color-red-0)' : style.bg,
                borderTopWidth: 3,
                borderTopColor: isPersonHere ? 'var(--mantine-color-red-5)' : style.border,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <Badge size="sm" color={style.badge} variant="filled" style={{ flexShrink: 0 }}>{room.name}</Badge>
                {hasCam && <IconCamera size={12} color="var(--mantine-color-red-6)" />}
                {!hasCam && !inferrable && <IconEyeOff size={12} color="var(--mantine-color-gray-5)" />}
              </div>
              {state && (
                <Text size="10px" c="dimmed">
                  {state.personPresent ? '🟢 有人' : '⚪ 无人'}
                  {state.deviceCount > 0 ? ` · ${state.deviceCount} 设备` : ''}
                </Text>
              )}
              {room.devices && room.devices.length > 0 && (
                <div style={{ display: 'flex', gap: 2, marginTop: 3, flexWrap: 'wrap' }}>
                  {room.devices.map((d) => (
                    <Badge key={d.id} size="xs" variant="light" color={d.status === 'active' ? (DEVICE_COLORS[d.deviceType] || 'gray') : 'gray'}>
                      {d.deviceType === 'pin' ? `🔑 ${d.serialNumber}` : d.deviceType}
                    </Badge>
                  ))}
                </div>
              )}
            </Paper>

            {isPersonHere && (
              <div style={{
                position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--mantine-color-red-6)',
                border: '3px solid white', boxShadow: '0 0 12px rgba(224,49,49,0.6)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            )}
          </div>
        )
      })}

      <style>{'@keyframes pulse{0%,100%{box-shadow:0 0 12px rgba(224,49,49,0.6)}50%{box-shadow:0 0 24px rgba(224,49,49,0.9),0 0 36px rgba(224,49,49,0.3)}}'}</style>
    </div>
  )
}