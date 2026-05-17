import { Group, Button, SegmentedControl, Select, Tooltip, ActionIcon } from '@mantine/core'
import { IconDeviceFloppy, IconTemplate } from '@tabler/icons-react'
import { TileFlag } from '@iomtea/shared-types'
import type { EditorMode, PaintType } from './EditorTypes'

interface ToolbarProps {
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
  paintType: PaintType
  onPaintTypeChange: (type: PaintType) => void
  onSave: () => void
  onOpenTemplate: () => void
  dirty: boolean
}

const PAINT_OPTIONS = [
  { value: String(TileFlag.VOID), label: '空' },
  { value: String(TileFlag.FLOOR), label: '地板' },
  { value: String(TileFlag.WALL), label: '墙' },
  { value: String(TileFlag.DOOR), label: '门' },
]

export function Toolbar({ mode, onModeChange, paintType, onPaintTypeChange, onSave, onOpenTemplate, dirty }: ToolbarProps) {
  return (
    <Group px="md" py={6} bg="gray.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <SegmentedControl
        size="xs"
        value={mode}
        onChange={(v) => onModeChange(v as EditorMode)}
        data={[
          { value: 'paint', label: '绘制' },
          { value: 'thing', label: '放置' },
          { value: 'select', label: '选择' },
        ]}
      />

      {mode === 'paint' && (
        <SegmentedControl
          size="xs"
          value={String(paintType)}
          onChange={(v) => onPaintTypeChange(Number(v) as PaintType)}
          data={PAINT_OPTIONS}
        />
      )}

      <Tooltip label={dirty ? '有未保存的更改' : '已保存'}>
        <Button
          size="xs"
          color={dirty ? 'yellow' : 'green'}
          leftSection={<IconDeviceFloppy size={14} />}
          onClick={onSave}
        >
          {dirty ? '保存*' : '保存'}
        </Button>
      </Tooltip>

      <Tooltip label="从模板生成">
        <ActionIcon size="sm" variant="subtle" onClick={onOpenTemplate}>
          <IconTemplate size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}
