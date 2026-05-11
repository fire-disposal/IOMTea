import type { EntityDef, ZoneDef, InteractionDef } from './types'

export const ENTITY_DEFS: EntityDef[] = [
  { id: 'bed', label: '床', category: 'furniture', size: { w: 2, h: 1 }, layer: 0, walkability: 'solid', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', tags: ['can-lie'], render2D: { icon: 'rect', color: '#8B7355' }, render3D: { component: 'Bed3D' } },
  { id: 'table', label: '桌子', category: 'furniture', size: { w: 2, h: 1 }, layer: 0, walkability: 'solid', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', tags: ['can-eat'], render2D: { icon: 'rect', color: '#A0846B' }, render3D: { component: 'Table3D' } },
  { id: 'sofa', label: '沙发', category: 'furniture', size: { w: 2, h: 1 }, layer: 0, walkability: 'solid', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', tags: ['can-sit'], render2D: { icon: 'rect', color: '#6B8F71' }, render3D: { component: 'Sofa3D' } },
  { id: 'cabinet', label: '柜子', category: 'furniture', size: { w: 1, h: 1 }, layer: 0, walkability: 'solid', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', render2D: { icon: 'rect', color: '#A0846B' }, render3D: { component: 'Cabinet3D' } },
  { id: 'toilet', label: '马桶', category: 'furniture', size: { w: 1, h: 1 }, layer: 0, walkability: 'solid', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', render2D: { icon: 'circle', color: '#E8E8E8' }, render3D: { component: 'Toilet3D' } },
  { id: 'sink', label: '水池', category: 'furniture', size: { w: 1, h: 1 }, layer: 0, walkability: 'solid', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', render2D: { icon: 'circle', color: '#B0C4DE' }, render3D: { component: 'Sink3D' } },
  { id: 'person', label: '人员', category: 'actor', size: { w: 1, h: 1 }, layer: 0, walkability: 'passable', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', render2D: { icon: 'circle', color: '#4CAF50' }, render3D: { component: 'Person3D' } },
  { id: 'mattress_sensor', label: '床垫传感器', category: 'sensor', size: { w: 1, h: 1 }, layer: 2, walkability: 'passable', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', render2D: { icon: 'circle', color: '#2196F3' }, render3D: { component: 'DeviceMarker3D' } },
  { id: 'air_sensor', label: '环境传感器', category: 'sensor', size: { w: 1, h: 1 }, layer: 2, walkability: 'passable', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', render2D: { icon: 'circle', color: '#00BCD4' }, render3D: { component: 'DeviceMarker3D' } },
  { id: 'emergency_btn', label: '紧急按钮', category: 'marker', size: { w: 1, h: 1 }, layer: 2, walkability: 'passable', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', render2D: { icon: 'circle', color: '#F44336' }, render3D: { component: 'DeviceMarker3D' } },
  { id: 'motion_sensor', label: '体动传感器', category: 'sensor', size: { w: 1, h: 1 }, layer: 2, walkability: 'passable', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', render2D: { icon: 'circle', color: '#FF9800' }, render3D: { component: 'DeviceMarker3D' } },
  { id: 'tv', label: '电视', category: 'furniture', size: { w: 1, h: 1 }, layer: 2, walkability: 'passable', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', render2D: { icon: 'rect', color: '#424242' }, render3D: { component: 'TV3D' } },
  { id: 'door', label: '门', category: 'structure', size: { w: 1, h: 1 }, layer: 0, walkability: 'dynamic', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', render2D: { icon: 'line', color: '#795548' }, render3D: { component: 'Door3D' } },
  { id: 'window', label: '窗户', category: 'structure', size: { w: 1, h: 1 }, layer: 0, walkability: 'solid', pivot: { x: 0.5, y: 0.5 }, defaultOrientation: 'N', render2D: { icon: 'line', color: '#90CAF9' }, render3D: { component: 'Window3D' } },
]

export const ZONE_DEFS: ZoneDef[] = [
  { id: 'bedroom', label: '卧室', color: '#e8f5e9' },
  { id: 'livingroom', label: '客厅', color: '#fff3e0' },
  { id: 'kitchen', label: '厨房', color: '#fce4ec' },
  { id: 'bathroom', label: '卫浴', color: '#e3f2fd' },
  { id: 'hall', label: '走廊', color: '#f5f5f5' },
  { id: 'custom', label: '自定义', color: '#eeeeee' },
]

export const INTERACTION_DEFS: InteractionDef[] = [
  { type: 'sleep', label: '睡眠', requiresTag: 'can-lie', posture: 'lying', defaultDuration: 480 },
  { type: 'rest', label: '休息', requiresTag: 'can-sit', posture: 'sitting', defaultDuration: 60 },
  { type: 'eat', label: '用餐', requiresTag: 'can-eat', posture: 'sitting', defaultDuration: 30 },
]

export function getEntityDef(id: string): EntityDef | undefined {
  return ENTITY_DEFS.find((d) => d.id === id)
}

export function getZoneDef(id: string): ZoneDef | undefined {
  return ZONE_DEFS.find((d) => d.id === id)
}

export function getInteractionDef(type: string): InteractionDef | undefined {
  return INTERACTION_DEFS.find((d) => d.type === type)
}
