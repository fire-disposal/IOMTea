import { Button, Paper, Stack, Text, Tooltip, Select } from '@mantine/core'
import { ENTITY_DEFS, ZONE_DEFS } from '@iomtea/shared-types/map'

type ToolMode = 'select' | 'draw-room' | { type: 'place-entity'; defId: string }

interface ToolbarProps {
  mode: ToolMode
  onChangeMode: (mode: ToolMode) => void
  zoneDefId: string
  onChangeZoneDef: (defId: string) => void
  onSave: () => void
  saving: boolean
}

const PLACABLE_DEFS = ENTITY_DEFS.filter((d) =>
  d.category === 'furniture' || d.category === 'sensor' || d.category === 'structure' || d.category === 'actor',
)

export function Toolbar({ mode, onChangeMode, zoneDefId, onChangeZoneDef, onSave, saving }: ToolbarProps) {
  const isSelect = mode === 'select'
  const isDrawRoom = mode === 'draw-room'

  return (
    <Paper p="xs" w={140} withBorder style={{ flexShrink: 0 }}>
      <Stack gap="xs">
        <Button size="xs" variant={isSelect ? 'filled' : 'light'} onClick={() => onChangeMode('select')}>
          选择
        </Button>
        <Button size="xs" variant={isDrawRoom ? 'filled' : 'light'} onClick={() => onChangeMode('draw-room')}>
          画房间
        </Button>
        {isDrawRoom && (
          <Select
            size="xs"
            data={ZONE_DEFS.map((z) => ({ value: z.id, label: z.label }))}
            value={zoneDefId}
            onChange={(v) => v && onChangeZoneDef(v)}
            placeholder="房间类型"
          />
        )}

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

        <Button size="xs" color="green" onClick={onSave} loading={saving} mt="md">
          保存地图
        </Button>
      </Stack>
    </Paper>
  )
}
