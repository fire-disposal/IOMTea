import { useMemo } from 'react'
import {
  type MapModel,
  type Zone,
  type Entity,
  buildGrid,
  createEmptyTiles,
} from '@iomtea/shared-types/map'

function createDemoMap(): MapModel {
  const width = 15
  const height = 13

  const zones: Zone[] = [
    { id: 'z1', defId: 'bedroom', name: '主卧', bounds: { x1: 0, y1: 0, x2: 4, y2: 4 } },
    { id: 'z2', defId: 'bedroom', name: '次卧1', bounds: { x1: 10, y1: 0, x2: 14, y2: 4 } },
    { id: 'z3', defId: 'livingroom', name: '客厅', bounds: { x1: 5, y1: 0, x2: 9, y2: 3 } },
    { id: 'z4', defId: 'kitchen', name: '厨房', bounds: { x1: 5, y1: 4, x2: 9, y2: 6 } },
    { id: 'z5', defId: 'bedroom', name: '次卧2', bounds: { x1: 10, y1: 5, x2: 14, y2: 9 } },
    { id: 'z6', defId: 'bathroom', name: '卫浴', bounds: { x1: 0, y1: 5, x2: 4, y2: 7 } },
    { id: 'z7', defId: 'hall', name: '走廊', bounds: { x1: 3, y1: 8, x2: 11, y2: 9 } },
  ]

  const entities: Entity[] = [
    { id: 'bed1', defId: 'bed', gridX: 1, gridY: 1, layer: 0, orientation: 'N', patientId: '', status: 'normal' },
    { id: 'mat1', defId: 'mattress_sensor', gridX: 1, gridY: 1, layer: 2, orientation: 'N', status: 'normal' },
    { id: 'bed2', defId: 'bed', gridX: 11, gridY: 1, layer: 0, orientation: 'N', patientId: '', status: 'normal' },
    { id: 'mat2', defId: 'mattress_sensor', gridX: 11, gridY: 1, layer: 2, orientation: 'N', status: 'normal' },
    { id: 'bed3', defId: 'bed', gridX: 11, gridY: 6, layer: 0, orientation: 'N', patientId: '', status: 'normal' },
    { id: 'mat3', defId: 'mattress_sensor', gridX: 11, gridY: 6, layer: 2, orientation: 'N', status: 'normal' },
    { id: 'sofa1', defId: 'sofa', gridX: 7, gridY: 2, layer: 0, orientation: 'S', status: 'normal' },
    { id: 'tv1', defId: 'tv', gridX: 5, gridY: 0, layer: 2, orientation: 'S', status: 'normal' },
    { id: 'table1', defId: 'table', gridX: 6, gridY: 5, layer: 0, orientation: 'N', status: 'normal' },
    { id: 'toilet1', defId: 'toilet', gridX: 1, gridY: 6, layer: 0, orientation: 'N', status: 'normal' },
    { id: 'sink1', defId: 'sink', gridX: 3, gridY: 6, layer: 0, orientation: 'N', status: 'normal' },
    { id: 'person1', defId: 'person', gridX: 1, gridY: 1, layer: 0, orientation: 'N', patientId: '', status: 'normal' },
    { id: 'person2', defId: 'person', gridX: 11, gridY: 1, layer: 0, orientation: 'N', patientId: '', status: 'normal' },
    { id: 'person3', defId: 'person', gridX: 11, gridY: 6, layer: 0, orientation: 'N', patientId: '', status: 'normal' },
    { id: 'person4', defId: 'person', gridX: 7, gridY: 2, layer: 0, orientation: 'N', patientId: '', status: 'normal' },
    { id: 'person5', defId: 'person', gridX: 6, gridY: 5, layer: 0, orientation: 'N', patientId: '', status: 'normal' },
  ]

  const model: MapModel = {
    id: 'demo-ward',
    width,
    height,
    tileSize: 1,
    tiles: createEmptyTiles(width, height),
    zones,
    entities,
  }

  buildGrid(model)
  return model
}

export function useMapModel(): MapModel {
  return useMemo(() => createDemoMap(), [])
}
