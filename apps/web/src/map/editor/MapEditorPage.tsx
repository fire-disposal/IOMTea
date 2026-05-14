import { useState, useCallback, useMemo, useEffect } from 'react'
import { Container, Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useParams } from 'react-router-dom'
import type { MapModel, Entity, Zone } from '@iomtea/shared-types/map'
import { buildGrid, createEmptyTiles } from '@iomtea/shared-types/map'
import { mergeZones } from '@iomtea/shared-types/map'
import { useMapModel } from '../useMapModel'
import { usePatientStore } from '../../store/patients'
import { trpc } from '../../trpc'
import { Toolbar } from './Toolbar'
import { MapCanvas2D } from './MapCanvas2D'
import { PropertiesPanel } from './PropertiesPanel'

type ToolMode = 'select' | 'draw-room' | { type: 'place-entity'; defId: string }

const ORIENTATIONS = ['N', 'E', 'S', 'W'] as const

function gridToMapModel(width: number, height: number, grid: number[][], zones: Zone[], entities: Entity[], id?: string): MapModel {
  const tiles = Array.from({ length: height }, (_: unknown, y: number) =>
    Array.from({ length: width }, (_: unknown, x: number) => ({
      terrain: (grid[y]?.[x] === 1 || grid[y]?.[x] === 2 ? 'floor' : 'void') as 'floor' | 'void',
    })),
  )
  return { id: id || 'local', width, height, tileSize: 1, tiles, zones, entities }
}

function tilesToGrid(tiles: { terrain: string }[][]): number[][] {
  return tiles.map((row) => row.map((t) => (t.terrain === 'floor' ? 1 : 0)))
}

export function MapEditorPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const savedMapId = mapId && mapId !== 'new' ? mapId : undefined

  const serverModelData = useMapModel(savedMapId)

  const [model, setModel] = useState<MapModel>(() => ({
    id: 'local',
    width: 16,
    height: 11,
    tileSize: 1,
    tiles: createEmptyTiles(16, 11),
    zones: [] as Zone[],
    entities: [] as Entity[],
  }))
  const [modelReady, setModelReady] = useState(false)
  const [mode, setMode] = useState<ToolMode>('select')
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [zoneDefId, setZoneDefId] = useState('bedroom')
  const [, setIsDirty] = useState(false)
  const [serverMapId, setServerMapId] = useState<string | null>(savedMapId || null)

  const patients = usePatientStore((s) => s.patients)
  const patientOptions = useMemo(
    () => patients.map((p) => ({ value: p.id, label: p.name })),
    [patients],
  )

  const updateMap = trpc.twin.maps.update.useMutation()
  const createMap = trpc.twin.maps.create.useMutation()

  useEffect(() => {
    if (serverModelData && !modelReady) {
      const zones: Zone[] = (serverModelData.rooms || []).map((r: any) => ({
        id: r.id,
        defId: r.roomType || 'custom',
        name: r.name || '',
        bounds: { x1: r.x, y1: r.y, x2: r.x + r.w - 1, y2: r.y + r.h - 1 },
      }))
      const entities: Entity[] = (serverModelData.entities || []).map((e: any) => ({
        id: e.id,
        defId: e.defId,
        gridX: e.gridX,
        gridY: e.gridY,
        layer: (e.layer ?? 0) as 0 | 1 | 2,
        orientation: e.orientation || 'N',
        patientId: e.properties?.patientId || undefined,
        status: 'normal',
      }))
      const m = gridToMapModel(serverModelData.width, serverModelData.height, serverModelData.grid || [], zones, entities, serverModelData.id)
      buildGrid(m)
      setModel(m)
      setModelReady(true)
    }
  }, [serverModelData, modelReady])

  const selectedEntity = model.entities.find((e) => e.id === selectedEntityId) || null

  const rebuild = useCallback((newModel: MapModel) => {
    buildGrid(newModel)
    setModel({ ...newModel })
  }, [])

  const handleSave = useCallback(async () => {
    try {
      const grid = tilesToGrid(model.tiles)

      if (serverMapId) {
        await updateMap.mutateAsync({ id: serverMapId, grid })
        notifications.show({ title: '已保存', message: '地图已保存到服务器', color: 'green' })
      } else if (patients.length > 0) {
        const created = await createMap.mutateAsync({
          patientId: patients[0].id,
          name: '家庭地图',
          width: model.width,
          height: model.height,
          grid,
        })
        setServerMapId(created.id)
        notifications.show({ title: '已保存', message: '地图已创建并保存', color: 'green' })
      } else {
        notifications.show({ title: '无法保存', message: '没有可用的患者，请先添加患者', color: 'red' })
      }
      setIsDirty(false)
    } catch (err: any) {
      notifications.show({ title: '保存失败', message: err?.message || '未知错误', color: 'red' })
    }
  }, [model, serverMapId, patients, updateMap, createMap])

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

  const isSaving = updateMap.isPending || createMap.isPending

  return (
    <Container fluid p={0} style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <Group style={{ flex: 1, overflow: 'hidden' }} gap={0} wrap="nowrap">
        <Toolbar
          mode={mode}
          onChangeMode={setMode}
          zoneDefId={zoneDefId}
          onChangeZoneDef={setZoneDefId}
          onSave={handleSave}
          saving={isSaving}
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
          {serverMapId && ` | 地图ID: ${serverMapId.slice(0, 8)}...`}
        </Text>
        <Text size="xs" c="dimmed">右键删除区域 · R旋转实体 · Delete删除实体</Text>
      </Group>
    </Container>
  )
}
