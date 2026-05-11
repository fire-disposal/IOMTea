// ── Grid ──

export interface Tile {
  terrain: 'floor' | 'void'
}

// ── Zone ──

export interface ZoneDef {
  id: string
  label: string
  color: string
  defaultSize?: { w: number; h: number }
  requirements?: {
    minSize?: number
    entities?: { defId: string; min: number }[]
    enclosed?: boolean
  }
}

export interface Zone {
  id: string
  defId: string
  name: string
  bounds: { x1: number; y1: number; x2: number; y2: number }
}

// ── Entity ──

export interface EntityDef {
  id: string
  label: string
  category: 'furniture' | 'actor' | 'sensor' | 'marker' | 'structure'
  size: { w: number; h: number }
  layer: 0 | 1 | 2
  walkability: 'solid' | 'passable' | 'dynamic'
  pivot: { x: number; y: number }
  defaultOrientation: 'N' | 'S' | 'E' | 'W'
  tags?: string[]
  render2D?: { icon: string; color: string }
  render3D?: { component: string }
}

export interface Entity {
  id: string
  defId: string
  gridX: number
  gridY: number
  layer: 0 | 1 | 2
  orientation: 'N' | 'S' | 'E' | 'W'
  patientId?: string
  status?: 'normal' | 'warning' | 'alert'
  meta?: Record<string, unknown>
}

// ── Structure ──

export interface WallSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  type: 'wall' | 'door' | 'window'
}

// ── MapModel ──

export interface MapModel {
  id: string
  width: number
  height: number
  tileSize: number
  tiles: Tile[][]
  zones: Zone[]
  entities: Entity[]
}

// ── Behavior ──

export type EntityState = 'idle' | 'moving' | 'acting'

export interface InteractionDef {
  type: string
  label: string
  requiresTag: string
  posture: 'standing' | 'sitting' | 'lying'
  defaultDuration: number
}

export interface Interaction {
  type: string
  targetEntityId?: string
  targetTile: { x: number; y: number }
  durationMinutes: number
  posture: 'standing' | 'sitting' | 'lying'
  startedAt: number
}

export interface EntityRuntime {
  entityId: string
  state: EntityState
  currentTile: { x: number; y: number }
  path?: { x: number; y: number }[]
  pathProgress?: number
  interaction?: Interaction
}

export interface ScheduleEntry {
  startHour: number
  endHour: number
  interactionType: string
  requiresTag: string
}

export interface EntitySchedule {
  entries: ScheduleEntry[]
  source: 'synthetic' | 'observed'
}

export interface BehavioralProfile {
  zoneDwell: Record<string, { meanMin: number; stdMin: number }>
  interactions: Record<string, { perDay: number; typicalMin: number }>
  activityByHour: number[]
}

export interface BehaviorEvent {
  timestamp: number
  entityId: string
  type: 'zone_enter' | 'zone_exit' | 'interaction_start' | 'interaction_end' | 'state_change'
  zoneId?: string
  interactionType?: string
}
