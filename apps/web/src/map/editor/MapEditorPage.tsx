import { useState, useCallback } from 'react'
import { Container, Group, Text } from '@mantine/core'
import type { MapModel, Entity, Zone } from '@iomtea/shared-types/map'
import { getEntityDef, buildGrid } from '@iomtea/shared-types/map'
import { useMapModel } from '../useMapModel'
import { Toolbar } from './Toolbar'
import { MapCanvas2D } from './MapCanvas2D'
import { PropertiesPanel } from './PropertiesPanel'

type ToolMode = 'select' | 'draw-room' | { type: 'place-entity'; defId: string }

export function MapEditorPage() {
  const initialModel = useMapModel()
  const [model, setModel] = useState<MapModel>({ ...initialModel })
  const [mode, setMode] = useState<ToolMode>('select')
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)

  const selectedEntity = model.entities.find((e) => e.id === selectedEntityId) || null

  const rebuild = useCallback((newModel: MapModel) => {
    buildGrid(newModel)
    setModel({ ...newModel })
  }, [])

  const handleAddEntity = useCallback(
    (entity: Entity) => {
      const newModel = { ...model, entities: [...model.entities, entity] }
      rebuild(newModel)
    },
    [model, rebuild],
  )

  const handleDeleteEntity = useCallback(
    (id: string) => {
      const newModel = { ...model, entities: model.entities.filter((e) => e.id !== id) }
      rebuild(newModel)
      if (selectedEntityId === id) setSelectedEntityId(null)
    },
    [model, selectedEntityId, rebuild],
  )

  const handleUpdateEntity = useCallback(
    (entity: Entity) => {
      const newModel = {
        ...model,
        entities: model.entities.map((e) => (e.id === entity.id ? entity : e)),
      }
      rebuild(newModel)
    },
    [model, rebuild],
  )

  const handleMoveEntity = useCallback(
    (id: string, x: number, y: number) => {
      const newModel = {
        ...model,
        entities: model.entities.map((e) => (e.id === id ? { ...e, gridX: x, gridY: y } : e)),
      }
      rebuild(newModel)
    },
    [model, rebuild],
  )

  const handleAddZone = useCallback(
    (zone: Zone) => {
      const newModel = { ...model, zones: [...model.zones, zone] }
      rebuild(newModel)
    },
    [model, rebuild],
  )

  return (
    <Container fluid p={0} style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <Group style={{ flex: 1, overflow: 'hidden' }} gap={0} wrap="nowrap">
        <Toolbar mode={mode} onChangeMode={setMode} />
        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          <MapCanvas2D
            model={model}
            mode={mode}
            selectedEntityId={selectedEntityId}
            onSelectEntity={setSelectedEntityId}
            onAddEntity={handleAddEntity}
            onAddZone={handleAddZone}
            onMoveEntity={handleMoveEntity}
          />
        </div>
        <PropertiesPanel
          selectedEntity={selectedEntity}
          onDelete={handleDeleteEntity}
          onUpdate={handleUpdateEntity}
        />
      </Group>
      <Group px="xs" py={4} bg="gray.1" justify="space-between">
        <Text size="xs" c="dimmed">
          区域: {model.zones.length} | 实体: {model.entities.length}
        </Text>
      </Group>
    </Container>
  )
}
