import { ThingDef, Thing, TagCompound } from '../types'

export const BUILTIN_THING_TAGS: Record<string, TagCompound> = {
  wall:      { blocksMovement: true },
  door:      { isDoorConnector: true },
  exit_door: { isDoorConnector: true, exitDoor: { isExit: true, homeStatus: 'home' }, sensors: ['door_magnet'] },
  bed:       { sensors: ['heart_rate', 'respiratory_rate', 'bed_exit', 'motion'] },
  sofa:      { sensors: ['pressure', 'seated_hours'] },
  chair:     { sensors: ['pressure'] },
  ac:        { actuators: ['ac_mode', 'temperature_setpoint'], sensors: ['temperature', 'humidity', 'power'] },
  fridge:    { sensors: ['door_open_count', 'temperature'] },
  tv:        { sensors: ['power_state', 'screen_time'] },
  light:     { actuators: ['light_brightness'] },
  smoke_alarm: { sensors: ['smoke_level'] },
  gas_sensor:  { sensors: ['gas_level'] },
  window:    { sensors: ['window_magnet', 'temperature'] },
  dining_table: {},
  toilet:    {},
  shower:    {},
  sink:      {},
  wardrobe:  {},
  desk:      {},
}

export const BUILTIN_THINGS: ThingDef[] = [
  { type: 'wall', label: '墙', tileW: 1, tileH: 1, category: 'structure', defaultTags: { blocksMovement: true } },
  { type: 'door', label: '门', tileW: 1, tileH: 1, category: 'structure', defaultTags: { isDoorConnector: true } },
  { type: 'exit_door', label: '出口门', tileW: 1, tileH: 1, category: 'structure', defaultTags: { isDoorConnector: true, exitDoor: { isExit: true, homeStatus: 'home' }, sensors: ['door_magnet'] } },
  { type: 'bed', label: '智能床', tileW: 2, tileH: 1, category: 'device', defaultTags: { sensors: ['heart_rate', 'respiratory_rate', 'bed_exit', 'motion'] } },
  { type: 'sofa', label: '沙发', tileW: 2, tileH: 1, category: 'device', defaultTags: { sensors: ['pressure', 'seated_hours'] } },
  { type: 'chair', label: '座椅', tileW: 1, tileH: 1, category: 'device', defaultTags: { sensors: ['pressure'] } },
  { type: 'ac', label: '空调', tileW: 1, tileH: 1, category: 'device', defaultTags: { actuators: ['ac_mode', 'temperature_setpoint'], sensors: ['temperature', 'humidity', 'power'] } },
  { type: 'fridge', label: '冰箱', tileW: 1, tileH: 1, category: 'device', defaultTags: { sensors: ['door_open_count', 'temperature'] } },
  { type: 'tv', label: '电视', tileW: 1, tileH: 1, category: 'device', defaultTags: { sensors: ['power_state', 'screen_time'] } },
  { type: 'light', label: '灯具', tileW: 1, tileH: 1, category: 'device', defaultTags: { actuators: ['light_brightness'] } },
  { type: 'smoke_alarm', label: '烟雾报警器', tileW: 1, tileH: 1, category: 'device', defaultTags: { sensors: ['smoke_level'] } },
  { type: 'gas_sensor', label: '燃气传感器', tileW: 1, tileH: 1, category: 'device', defaultTags: { sensors: ['gas_level'] } },
  { type: 'window', label: '窗', tileW: 1, tileH: 1, category: 'device', defaultTags: { sensors: ['window_magnet', 'temperature'] } },
  { type: 'dining_table', label: '餐桌', tileW: 2, tileH: 1, category: 'furnishing', defaultTags: {} },
  { type: 'toilet', label: '马桶', tileW: 1, tileH: 1, category: 'furnishing', defaultTags: {} },
  { type: 'shower', label: '淋浴', tileW: 1, tileH: 1, category: 'furnishing', defaultTags: {} },
  { type: 'sink', label: '洗手台', tileW: 1, tileH: 1, category: 'furnishing', defaultTags: {} },
  { type: 'wardrobe', label: '衣柜', tileW: 1, tileH: 1, category: 'furnishing', defaultTags: {} },
  { type: 'desk', label: '书桌', tileW: 1, tileH: 1, category: 'furnishing', defaultTags: {} },
]

export function getThingDef(type: string): ThingDef | undefined {
  return BUILTIN_THINGS.find(t => t.type === type)
}

export function resolveThingTags(thing: Thing): TagCompound {
  const defaults = BUILTIN_THING_TAGS[thing.thingType] ?? {}
  return { ...defaults, ...thing.tags }
}
