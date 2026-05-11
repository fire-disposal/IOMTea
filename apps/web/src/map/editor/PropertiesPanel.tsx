import { Paper, Stack, Text, Button, Group } from '@mantine/core'
import type { Entity } from '@iomtea/shared-types/map'
import { getEntityDef } from '@iomtea/shared-types/map'

interface PropertiesPanelProps {
  selectedEntity: Entity | null
  onDelete: (id: string) => void
  onUpdate: (entity: Entity) => void
}

export function PropertiesPanel({ selectedEntity, onDelete, onUpdate }: PropertiesPanelProps) {
  if (!selectedEntity) {
    return (
      <Paper p="md" w={200} withBorder style={{ flexShrink: 0 }}>
        <Text size="sm" c="dimmed" ta="center">未选中实体</Text>
      </Paper>
    )
  }

  const def = getEntityDef(selectedEntity.defId)

  return (
    <Paper p="md" w={200} withBorder style={{ flexShrink: 0 }}>
      <Stack gap="sm">
        <Text size="sm" fw={600}>实体属性</Text>
        <Text size="xs">类型: {def?.label || selectedEntity.defId}</Text>
        <Text size="xs">位置: ({selectedEntity.gridX}, {selectedEntity.gridY})</Text>
        <Text size="xs">层: {selectedEntity.layer}</Text>
        <Text size="xs">朝向: {selectedEntity.orientation}</Text>
        <Group gap="xs">
          {['N', 'S', 'E', 'W'].map((o) => (
            <Button
              key={o}
              size="xs"
              variant={selectedEntity.orientation === o ? 'filled' : 'light'}
              onClick={() => onUpdate({ ...selectedEntity, orientation: o as 'N' | 'S' | 'E' | 'W' })}
            >
              {o}
            </Button>
          ))}
        </Group>
        <Button size="xs" color="red" variant="light" onClick={() => onDelete(selectedEntity.id)}>
          删除实体
        </Button>
      </Stack>
    </Paper>
  )
}
