import type { MapModel, Zone, Entity } from './types'
import { buildGrid, createEmptyTiles } from './grid'

interface DefaultMapConfig {
  width: number
  height: number
  zones: { defId: string; name: string; x1: number; y1: number; x2: number; y2: number }[]
  entities: { defId: string; gridX: number; gridY: number; layer?: number; orientation?: 'N' | 'S' | 'E' | 'W'; patientIndex?: number }[]
}

const DEFAULT_CONFIG: DefaultMapConfig = {
  width: 16,
  height: 11,
  zones: [
    // Row 0-4: bedrooms + living room
    { defId: 'bedroom', name: '主卧', x1: 0, y1: 0, x2: 4, y2: 4 },
    { defId: 'livingroom', name: '客厅', x1: 5, y1: 0, x2: 9, y2: 4 },
    { defId: 'bedroom', name: '次卧', x1: 10, y1: 0, x2: 15, y2: 4 },
    // Row 5-8: bathroom, kitchen, study
    { defId: 'bathroom', name: '卫浴', x1: 0, y1: 5, x2: 4, y2: 8 },
    { defId: 'kitchen', name: '厨房', x1: 5, y1: 5, x2: 9, y2: 8 },
    { defId: 'bedroom', name: '书房', x1: 10, y1: 5, x2: 15, y2: 8 },
    // Row 9-10: hallway
    { defId: 'hall', name: '走廊', x1: 0, y1: 9, x2: 15, y2: 10 },
  ],
  entities: [
    // 主卧
    { defId: 'bed', gridX: 1, gridY: 1, patientIndex: 0 },
    { defId: 'mattress_sensor', gridX: 1, gridY: 1, layer: 2, patientIndex: 0 },
    { defId: 'person', gridX: 1, gridY: 1, patientIndex: 0 },
    // 次卧
    { defId: 'bed', gridX: 12, gridY: 1, patientIndex: 1 },
    { defId: 'mattress_sensor', gridX: 12, gridY: 1, layer: 2, patientIndex: 1 },
    { defId: 'person', gridX: 12, gridY: 1, patientIndex: 1 },
    // 书房
    { defId: 'bed', gridX: 12, gridY: 6, patientIndex: 2 },
    { defId: 'mattress_sensor', gridX: 12, gridY: 6, layer: 2, patientIndex: 2 },
    { defId: 'person', gridX: 12, gridY: 6, patientIndex: 2 },
    // 客厅
    { defId: 'sofa', gridX: 7, gridY: 2, orientation: 'S' },
    { defId: 'tv', gridX: 5, gridY: 0, layer: 2, orientation: 'S' },
    { defId: 'person', gridX: 7, gridY: 2, patientIndex: 3 },
    // 厨房
    { defId: 'table', gridX: 6, gridY: 6 },
    { defId: 'person', gridX: 6, gridY: 6, patientIndex: 4 },
    // 卫浴
    { defId: 'toilet', gridX: 1, gridY: 6 },
    { defId: 'sink', gridX: 3, gridY: 6 },
  ],
}

function genId(prefix: string, index: number): string {
  return `${prefix}-${index}`
}

export function createDefaultMap(patientIds: string[], config?: DefaultMapConfig): MapModel {
  const cfg = config || DEFAULT_CONFIG

  const zones: Zone[] = cfg.zones.map((z, i) => ({
    id: genId('zone', i + 1),
    defId: z.defId,
    name: z.name,
    bounds: { x1: z.x1, y1: z.y1, x2: z.x2, y2: z.y2 },
  }))

  const entities: Entity[] = cfg.entities.map((e, i) => ({
    id: genId(e.defId, i + 1),
    defId: e.defId,
    gridX: e.gridX,
    gridY: e.gridY,
    layer: (e.layer ?? 0) as 0 | 1 | 2,
    orientation: e.orientation || 'N',
    patientId: e.patientIndex !== undefined ? (patientIds[e.patientIndex] || '') : undefined,
    status: 'normal' as const,
  }))

  const model: MapModel = {
    id: 'default',
    width: cfg.width,
    height: cfg.height,
    tileSize: 1,
    tiles: createEmptyTiles(cfg.width, cfg.height),
    zones,
    entities,
  }

  buildGrid(model)
  return model
}
