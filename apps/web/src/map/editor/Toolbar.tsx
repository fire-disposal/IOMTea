import { Button, Paper, Stack, Text, Tooltip } from '@mantine/core'
import { ENTITY_DEFS } from '@iomtea/shared-types/map'

type ToolMode = 'select' | 'draw-room' | { type: 'place-entity'; defId: string }

interface ToolbarProps {
  mode: ToolMode
  onChangeMode: (mode: ToolMode) => void
}

const PLACABLE_DEFS = ENTITY_DEFS.filter((d) =>
  d.category === 'furniture' || d.category === 'sensor' || d.category === 'structure',
)

export function Toolbar({ mode, onChangeMode }: ToolbarProps) {
  const isSelect = mode === 'select'
  const isDrawRoom = mode === 'draw-room'

  return (
    <Paper p="xs" w={120} withBorder style={{ flexShrink: 0 }}>
      <Stack gap="xs">
        <Text size="xs" fw={600} c="dimmed">工具</Text>
        <Button size="xs" variant={isSelect ? 'filled' : 'light'} onClick={() => onChangeMode('select')}>
          选择
        </Button>
        <Button size="xs" variant={isDrawRoom ? 'filled' : 'light'} onClick={() => onChangeMode('draw-room')}>
          画房间
        </Button>
        <Text size="xs" fw={600} c="dimmed" mt="xs">实体</Text>
        {PLACABLE_DEFS.map((def) => {
          const isActive = typeof mode === 'object' && mode.type === 'place-entity' && mode.defId === def.id
          return (
            <Tooltip key={def.id} label={def.label} position="right">
              <Button
                size="xs"
                variant={isActive ? 'filled' : 'light'}
                color={isActive ? 'blue' : 'gray'}
                onClick={() => onChangeMode({ type: 'place-entity', defId: def.id })}
              >
                {def.label}
              </Button>
            </Tooltip>
          )
        })}
      </Stack>
    </Paper>
  )
}
