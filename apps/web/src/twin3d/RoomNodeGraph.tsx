import { Badge, Paper, Text, ThemeIcon } from '@mantine/core'
import { IconCamera, IconEyeOff } from '@tabler/icons-react'
import { useMemo } from 'react'

interface RoomNode {
  id: string; name: string; type: string; x: number; y: number; connections: string[]
  hasCamera?: boolean; inferrable?: boolean
}
interface RoomState {
  roomId: string; personPresent: boolean; hasCamera: boolean; inferrable: boolean; deviceCount: number
}

const ROOM_COLORS: Record<string, string> = {
  bedroom: 'blue', livingroom: 'matchaGreen', kitchen: 'orange',
  bathroom: 'cyan', study: 'violet', corridor: 'gray',
  entry: 'yellow', balcony: 'lime', storage: 'gray', dining: 'pink',
}

export function RoomNodeGraph({ rooms, personRoomId, roomStates }: {
  rooms: RoomNode[]; personRoomId?: string | null; roomStates?: RoomState[]
}) {
  const scale = 60
  const cx = rooms.reduce((s, r) => s + r.x, 0) / Math.max(rooms.length, 1)
  const cy = rooms.reduce((s, r) => s + r.y, 0) / Math.max(rooms.length, 1)

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
    <div style={{ width: '100%', height: '100%', overflow: 'auto', position: 'relative', background: '#f8f6f0' }}>
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
        const color = ROOM_COLORS[room.type] || 'gray'
        const hasCam = state?.hasCamera ?? room.hasCamera ?? false
        const inferrable = state?.inferrable ?? room.inferrable ?? false
        const left = (room.x - minX) * scale + 10
        const top = (room.y - minY) * scale + 10

        return (
          <div key={room.id} style={{ position: 'absolute', left, top, width: 140, transition: 'all 0.3s ease' }}>
            <Paper
              p="xs"
              radius="md"
              withBorder
              shadow={isPersonHere ? 'md' : 'sm'}
              style={{
                borderColor: isPersonHere ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-gray-3)',
                borderWidth: isPersonHere ? 2 : 1,
                background: isPersonHere ? 'var(--mantine-color-red-0)' : '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <Badge size="xs" color={color} variant="filled" style={{ flexShrink: 0 }}>{room.name}</Badge>
                {hasCam && <IconCamera size={10} color="var(--mantine-color-gray-6)" />}
                {!hasCam && !inferrable && <IconEyeOff size={10} color="var(--mantine-color-red-6)" />}
              </div>
              {state && (
                <Text size="10px" c="dimmed">
                  {state.personPresent ? '🟢 有人' : '⚪ 无人'}
                  {state.deviceCount > 0 ? ` · ${state.deviceCount} 设备` : ''}
                </Text>
              )}
            </Paper>

            {isPersonHere && (
              <div style={{
                position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                width: 20, height: 20, borderRadius: '50%', background: '#e03131',
                border: '2px solid white', boxShadow: '0 0 8px rgba(224,49,49,0.5)',
                transition: 'all 0.5s ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}