import type { MapModel, Zone, Entity } from './types'
import { buildGrid, createEmptyTiles } from './grid'

interface DefaultMapConfig {
  width: number
  height: number
  zones: { defId: string; name: string; x1: number; y1: number; x2: number; y2: number }[]
  entities: { defId: string; gridX: number; gridY: number; layer?: number; orientation?: 'N' | 'S' | 'E' | 'W'; patientIndex?: number }[]
}

const DEFAULT_CONFIG: DefaultMapConfig = {
  width: 15,
  height: 13,
  zones: [
    { defId: 'bedroom', name: '主卧', x1: 0, y1: 0, x2: 4, y2: 4 },
    { defId: 'bedroom', name: '次卧1', x1: 10, y1: 0, x2: 14, y2: 4 },
    { defId: 'livingroom', name: '客厅', x1: 5, y1: 0, x2: 9, y2: 3 },
    { defId: 'kitchen', name: '厨房', x1: 5, y1: 4, x2: 9, y2: 6 },
    { defId: 'bedroom', name: '次卧2', x1: 10, y1: 5, x2: 14, y2: 9 },
    { defId: 'bathroom', name: '卫浴', x1: 0, y1: 5, x2: 4, y2: 7 },
    { defId: 'hall', name: '走廊', x1: 3, y1: 8, x2: 11, y2: 9 },
  ],
  entities: [
    { defId: 'bed', gridX: 1, gridY: 1, patientIndex: 0 },
    { defId: 'mattress_sensor', gridX: 1, gridY: 1, layer: 2, patientIndex: 0 },
    { defId: 'bed', gridX: 11, gridY: 1, patientIndex: 1 },
    { defId: 'mattress_sensor', gridX: 11, gridY: 1, layer: 2, patientIndex: 1 },
    { defId: 'bed', gridX: 11, gridY: 6, patientIndex: 2 },
    { defId: 'mattress_sensor', gridX: 11, gridY: 6, layer: 2, patientIndex: 2 },
    { defId: 'sofa', gridX: 7, gridY: 2, orientation: 'S' },
    { defId: 'tv', gridX: 5, gridY: 0, layer: 2, orientation: 'S' },
    { defId: 'table', gridX: 6, gridY: 5 },
    { defId: 'toilet', gridX: 1, gridY: 6 },
    { defId: 'sink', gridX: 3, gridY: 6 },
    { defId: 'person', gridX: 1, gridY: 1, patientIndex: 0 },
    { defId: 'person', gridX: 11, gridY: 1, patientIndex: 1 },
    { defId: 'person', gridX: 11, gridY: 6, patientIndex: 2 },
    { defId: 'person', gridX: 7, gridY: 2, patientIndex: 3 },
    { defId: 'person', gridX: 6, gridY: 5, patientIndex: 4 },
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
