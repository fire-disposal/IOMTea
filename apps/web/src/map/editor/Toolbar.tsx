import { Button, Divider, Paper, Select, Stack, Text, Tooltip } from '@mantine/core'
import { ENTITY_DEFS, ZONE_DEFS } from '@iomtea/shared-types/map'

type ToolMode = 'select' | 'draw-room' | { type: 'place-entity'; defId: string }

interface ToolbarProps {
  mode: ToolMode
  onChangeMode: (mode: ToolMode) => void
  zoneDefId: string
  onChangeZoneDef: (defId: string) => void
  onSave: () => void
  saving: boolean
  isDirty?: boolean
}

const categoryLabel: Record<string, string> = {
  furniture: '家具',
  sensor: '传感器',
  structure: '结构',
  actor: '人员',
}

const categoryOrder = ['furniture', 'actor', 'sensor', 'structure', 'marker']

const groupedDefs = categoryOrder
  .map((cat) => ({
    category: cat,
    label: categoryLabel[cat] || cat,
    defs: ENTITY_DEFS.filter((d) => d.category === cat),
  }))
  .filter((g) => g.defs.length > 0)

export function Toolbar({ mode, onChangeMode, zoneDefId, onChangeZoneDef, onSave, saving, isDirty }: ToolbarProps) {
  const isSelect = mode === 'select'
  const isDrawRoom = mode === 'draw-room'

  return (
    <Paper p="xs" w={150} withBorder style={{ flexShrink: 0 }}>
      <Stack gap={4}>
        <Button size="xs" variant={isSelect ? 'filled' : 'light'} onClick={() => onChangeMode('select')}>
          选择
        </Button>
        <Button size="xs" variant={isDrawRoom ? 'filled' : 'light'} onClick={() => onChangeMode('draw-room')}>
          画房间
        </Button>
        <Select
          size="xs"
          data={ZONE_DEFS.map((z) => ({ value: z.id, label: z.label }))}
          value={zoneDefId}
          onChange={(v) => v && onChangeZoneDef(v)}
          disabled={!isDrawRoom}
          placeholder="房间类型"
          mt={4}
        />

        {groupedDefs.map((group) => (
          <Stack key={group.category} gap={2}>
            <Divider label={group.label} labelPosition="left" mt={4} />
            {group.defs.map((def) => {
              const isActive = typeof mode === 'object' && mode.type === 'place-entity' && mode.defId === def.id
              return (
                <Tooltip key={def.id} label={def.label} position="right">
                  <Button
                    size="xs"
                    variant={isActive ? 'filled' : 'light'}
                    color={isActive ? 'blue' : 'gray'}
                    fullWidth
                    onClick={() => onChangeMode({ type: 'place-entity', defId: def.id })}
                  >
                    {def.label}
                  </Button>
                </Tooltip>
              )
            })}
          </Stack>
        ))}

        <Button size="xs" color="green" onClick={onSave} loading={saving} mt="xs">
          {isDirty ? '保存地图 *' : '保存地图'}
        </Button>
      </Stack>
    </Paper>
  )
}
