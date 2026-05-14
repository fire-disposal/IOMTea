import { useState, useCallback, useMemo } from 'react'
import { Container, Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import type { MapModel, Entity, Zone } from '@iomtea/shared-types/map'
import { buildGrid } from '@iomtea/shared-types/map'
import { mergeZones } from '@iomtea/shared-types/map'
import { useMapModel } from '../useMapModel'
import { usePatientStore } from '../../store/patients'
import { Toolbar } from './Toolbar'
import { MapCanvas2D } from './MapCanvas2D'
import { PropertiesPanel } from './PropertiesPanel'

type ToolMode = 'select' | 'draw-room' | { type: 'place-entity'; defId: string }

const ORIENTATIONS = ['N', 'E', 'S', 'W'] as const

export function MapEditorPage() {
  const initialModel = useMapModel()
  const [model, setModel] = useState<MapModel>({ ...initialModel })
  const [mode, setMode] = useState<ToolMode>('select')
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [zoneDefId, setZoneDefId] = useState('bedroom')
  const [, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const patients = usePatientStore((s) => s.patients)
  const patientOptions = useMemo(
    () => patients.map((p) => ({ value: p.id, label: p.name })),
    [patients],
  )

  const selectedEntity = model.entities.find((e) => e.id === selectedEntityId) || null

  const rebuild = useCallback((newModel: MapModel) => {
    buildGrid(newModel)
    setModel({ ...newModel })
  }, [])

  const handleSave = useCallback(() => {
    setSaving(true)
    setTimeout(() => {
      notifications.show({ title: '已保存', message: '地图已保存（本地）', color: 'green' })
      setSaving(false)
      setIsDirty(false)
    }, 300)
  }, [])

  const handleAddEntity = useCallback(
    (entity: Entity) => {
      const newModel = { ...model, entities: [...model.entities, entity] }
      rebuild(newModel)
      setIsDirty(true)
    },
    [model, rebuild],
  )

  const handleDeleteEntity = useCallback(
    (id: string) => {
      const newModel = { ...model, entities: model.entities.filter((e) => e.id !== id) }
      rebuild(newModel)
      if (selectedEntityId === id) setSelectedEntityId(null)
      setIsDirty(true)
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
      setIsDirty(true)
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
      setIsDirty(true)
    },
    [model, rebuild],
  )

  const handleRotateEntity = useCallback(
    (id: string) => {
      const ent = model.entities.find((e) => e.id === id)
      if (!ent) return
      const idx = ORIENTATIONS.indexOf(ent.orientation as any)
      const next = ORIENTATIONS[(idx + 1) % 4]
      handleUpdateEntity({ ...ent, orientation: next })
    },
    [model.entities, handleUpdateEntity],
  )

  const handleAddZone = useCallback(
    (zone: Zone) => {
      const sameType = model.zones.filter((z) => z.defId === zone.defId).length
      const name = `${zone.defId === 'bedroom' ? '卧室' : zone.defId === 'livingroom' ? '客厅' : zone.defId === 'kitchen' ? '厨房' : zone.defId === 'bathroom' ? '卫浴' : zone.defId === 'hall' ? '走廊' : '房间'} ${sameType + 1}`
      const merged = mergeZones(model.zones, { ...zone, name })
      const newModel = { ...model, zones: merged }
      rebuild(newModel)
      setIsDirty(true)
    },
    [model, rebuild],
  )

  const handleDeleteZone = useCallback(
    (zoneId: string) => {
      const newModel = { ...model, zones: model.zones.filter((z) => z.id !== zoneId) }
      rebuild(newModel)
      setIsDirty(true)
    },
    [model, rebuild],
  )

  const handleRenameZone = useCallback(
    (zoneId: string, name: string) => {
      const newModel = {
        ...model,
        zones: model.zones.map((z) => (z.id === zoneId ? { ...z, name } : z)),
      }
      rebuild(newModel)
      setIsDirty(true)
    },
    [model, rebuild],
  )

  return (
    <Container fluid p={0} style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <Group style={{ flex: 1, overflow: 'hidden' }} gap={0} wrap="nowrap">
        <Toolbar
          mode={mode}
          onChangeMode={setMode}
          zoneDefId={zoneDefId}
          onChangeZoneDef={setZoneDefId}
          onSave={handleSave}
          saving={saving}
        />
        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          <MapCanvas2D
            model={model}
            mode={mode}
            zoneDefId={zoneDefId}
            selectedEntityId={selectedEntityId}
            onSelectEntity={setSelectedEntityId}
            onAddEntity={handleAddEntity}
            onAddZone={handleAddZone}
            onMoveEntity={handleMoveEntity}
            onDeleteEntity={handleDeleteEntity}
            onDeleteZone={handleDeleteZone}
            onRotateEntity={handleRotateEntity}
            onRenameZone={handleRenameZone}
          />
        </div>
        <PropertiesPanel
          selectedEntity={selectedEntity}
          patientOptions={patientOptions}
          onDelete={handleDeleteEntity}
          onUpdate={handleUpdateEntity}
        />
      </Group>
      <Group px="xs" py={4} bg="gray.1" justify="space-between">
        <Text size="xs" c="dimmed">
          区域: {model.zones.length} | 实体: {model.entities.length}
          {selectedEntity && ` | 选中: ${selectedEntity.defId} (${selectedEntity.gridX},${selectedEntity.gridY})`}
        </Text>
        <Text size="xs" c="dimmed">右键删除区域 · R旋转实体 · Delete删除实体</Text>
      </Group>
    </Container>
  )
}
