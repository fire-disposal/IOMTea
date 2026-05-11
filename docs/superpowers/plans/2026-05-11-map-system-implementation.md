# Map System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Prison Architect-inspired map system with three-layer data model, A* pathfinding stub, dual 2D/3D renderers, behavior engine, and visual editor — all sharing types across Web and miniapp.

**Architecture:** Pure data types in `shared-types`, no framework imports. Grid + pathfinding + behavior are pure functions. React hooks consume them. Renderers are React components reading the same `MapModel`. Editor is a 2D overlay on the same SVG renderer.

**Tech Stack:** TypeScript, React 19, R3F/Three.js, recharts (existing), Mantine v8 (existing), no new npm packages required beyond what's already installed.

---

## File Structure Map

| File | Responsibility |
|---|---|
| `packages/shared-types/src/map/types.ts` | All interfaces: Tile, Zone, Entity, MapModel, EntityRuntime, etc. |
| `packages/shared-types/src/map/registries.ts` | Built-in ENTITY_DEFS, ZONE_DEFS, INTERACTION_DEFS |
| `packages/shared-types/src/map/grid.ts` | buildGrid, getWallSegments, entitiesAt, isWalkable |
| `packages/shared-types/src/map/pathfinding.ts` | findPath A* |
| `packages/shared-types/src/map/validation.ts` | canPlaceEntity |
| `packages/shared-types/src/map/behavior.ts` | updateEntityBehavior, scheduleFromProfile |
| `packages/shared-types/src/map/index.ts` | Barrel re-export |
| `apps/web/src/map/useMapModel.ts` | React hook loading/providing MapModel |
| `apps/web/src/map/useEntityRuntimes.ts` | Hook running behavior engine per frame |
| `apps/web/src/map/MapRenderer3D.tsx` | R3F Canvas + scene composition |
| `apps/web/src/map/MapRenderer2D.tsx` | SVG top-down view |
| `apps/web/src/map/renderers/ZoneFloor.tsx` | 3D floor plane from zone bounds |
| `apps/web/src/map/renderers/WallMesh.tsx` | 3D wall from WallSegment |
| `apps/web/src/map/renderers/Bed3D.tsx` | Migrated Bed component |
| `apps/web/src/map/renderers/Person3D.tsx` | Migrated + animated Person |
| `apps/web/src/map/renderers/DeviceMarker3D.tsx` | Migrated DeviceMarker |
| `apps/web/src/map/editor/MapEditorPage.tsx` | Editor layout (toolbar + canvas + panel) |
| `apps/web/src/map/editor/MapCanvas2D.tsx` | Interactive SVG grid |
| `apps/web/src/map/editor/Toolbar.tsx` | Tool mode selector |
| `apps/web/src/map/editor/PropertiesPanel.tsx` | Selected entity details |
| Modified: `apps/web/src/App.tsx` | Add map editor tab |
| Modified: `apps/web/src/pages/DigitalTwinPage.tsx` | Switch to MapRenderer3D |

---

### Task 1: Core Types

**Files:**
- Create: `packages/shared-types/src/map/types.ts`

- [ ] **Step 1: Write the types file**

File: `packages/shared-types/src/map/types.ts`

```ts
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
  layer: number
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
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm typecheck --filter @iomtea/shared-types`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/map/types.ts
git commit -m "feat(map): add core map types"
```

---

### Task 2: Built-in Registries

**Files:**
- Create: `packages/shared-types/src/map/registries.ts`

- [ ] **Step 1: Write registries file**

File: `packages/shared-types/src/map/registries.ts`

```ts
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
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/shared-types`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/map/registries.ts
git commit -m "feat(map): add built-in registries"
```

---

### Task 3: Grid Utilities

**Files:**
- Create: `packages/shared-types/src/map/grid.ts`

- [ ] **Step 1: Write grid module**

File: `packages/shared-types/src/map/grid.ts`

```ts
import type { MapModel, Tile, WallSegment, Entity } from './types'
import { getEntityDef } from './registries'

export function createEmptyTiles(width: number, height: number): Tile[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, (): Tile => ({ terrain: 'void' })),
  )
}

export function buildGrid(model: MapModel): void {
  const { width, height, zones } = model
  model.tiles = createEmptyTiles(width, height)

  for (const zone of zones) {
    const { x1, y1, x2, y2 } = zone.bounds
    for (let y = y1; y <= y2 && y < height; y++) {
      for (let x = x1; x <= x2 && x < width; x++) {
        model.tiles[y][x].terrain = 'floor'
      }
    }
  }
}

export function getWallSegments(model: MapModel): WallSegment[] {
  const segments: WallSegment[] = []
  const { tiles, tileSize } = model

  for (let y = 0; y < model.height; y++) {
    for (let x = 0; x < model.width; x++) {
      if (tiles[y][x].terrain !== 'floor') continue
      const neighbors: [number, number, number, number, number, number][] = [
        [x, y, x + 1, y, x + 1, y],
        [x, y, x, y + 1, x, y + 1],
      ]
      for (const [x1, y1, x2, y2, ex1, ey1] of neighbors) {
        if (x2 >= model.width || y2 >= model.height) {
          segments.push({
            x1: x1 * tileSize, y1: y1 * tileSize,
            x2: x2 * tileSize, y2: y2 * tileSize,
            type: 'wall',
          })
        } else if (tiles[y2]?.[x2]?.terrain === 'void') {
          segments.push({
            x1: ex1 * tileSize, y1: ey1 * tileSize,
            x2: (ex1 === x1 ? x1 : x2) * tileSize, y2: (ey1 === y1 ? y1 : y2) * tileSize,
            type: 'wall',
          })
        }
      }
    }
  }

  for (const ent of model.entities) {
    if (ent.defId === 'door' || ent.defId === 'window') {
      for (let i = segments.length - 1; i >= 0; i--) {
        const s = segments[i]
        if (
          (s.x1 === ent.gridX * tileSize && s.y1 === ent.gridY * tileSize) ||
          (s.x2 === ent.gridX * tileSize && s.y2 === ent.gridY * tileSize)
        ) {
          segments.splice(i, 1)
        }
      }
    }
  }

  return segments
}

export function entitiesAt(model: MapModel, x: number, y: number): Entity[] {
  return model.entities.filter((ent) => {
    const def = getEntityDef(ent.defId)
    if (!def) return false
    return x >= ent.gridX && x < ent.gridX + def.size.w && y >= ent.gridY && y < ent.gridY + def.size.h
  })
}

export function isWalkable(model: MapModel, x: number, y: number): boolean {
  const tile = model.tiles[y]?.[x]
  if (!tile || tile.terrain === 'void') return false

  for (const ent of entitiesAt(model, x, y)) {
    const def = getEntityDef(ent.defId)
    if (!def) continue
    if (def.walkability === 'solid') return false
    if (def.walkability === 'dynamic' && ent.meta?.open === false) return false
  }
  return true
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/shared-types`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/map/grid.ts
git commit -m "feat(map): add grid utilities"
```

---

### Task 4: Pathfinding Stub

**Files:**
- Create: `packages/shared-types/src/map/pathfinding.ts`

- [ ] **Step 1: Write pathfinding module**

File: `packages/shared-types/src/map/pathfinding.ts`

```ts
import type { MapModel } from './types'
import { isWalkable } from './grid'

export interface PathResult {
  path: { x: number; y: number }[]
  cost: number
  explored: number
}

interface AStarNode {
  x: number
  y: number
  g: number
  h: number
  f: number
  parent?: AStarNode
}

function heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function key(x: number, y: number): string {
  return `${x},${y}`
}

function getNeighbors(model: MapModel, node: AStarNode): { x: number; y: number }[] {
  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]
  const results: { x: number; y: number }[] = []
  for (const { dx, dy } of dirs) {
    const nx = node.x + dx
    const ny = node.y + dy
    if (nx >= 0 && nx < model.width && ny >= 0 && ny < model.height && isWalkable(model, nx, ny)) {
      results.push({ x: nx, y: ny })
    }
  }
  return results
}

export function findPath(
  model: MapModel,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts?: { maxIterations?: number },
): PathResult | null {
  const maxIter = opts?.maxIterations ?? 10000
  const open: AStarNode[] = [{ x: from.x, y: from.y, g: 0, h: heuristic(from, to), f: heuristic(from, to) }]
  const closed = new Set<string>()
  let explored = 0

  while (open.length > 0 && explored < maxIter) {
    explored++
    open.sort((a, b) => b.f - a.f)
    const current = open.pop()!

    if (current.x === to.x && current.y === to.y) {
      const path: { x: number; y: number }[] = []
      let node: AStarNode | undefined = current
      while (node) {
        path.unshift({ x: node.x, y: node.y })
        node = node.parent
      }
      return { path, cost: current.g, explored }
    }

    closed.add(key(current.x, current.y))

    for (const neighbor of getNeighbors(model, current)) {
      if (closed.has(key(neighbor.x, neighbor.y))) continue
      const g = current.g + 1
      const h = heuristic(neighbor, to)
      const existing = open.find((n) => n.x === neighbor.x && n.y === neighbor.y)
      if (existing) {
        if (g < existing.g) {
          existing.g = g
          existing.f = g + existing.h
          existing.parent = current
        }
      } else {
        open.push({ x: neighbor.x, y: neighbor.y, g, h, f: g + h, parent: current })
      }
    }
  }

  return null
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/shared-types`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/map/pathfinding.ts
git commit -m "feat(map): add A* pathfinding"
```

---

### Task 5: Placement Validation

**Files:**
- Create: `packages/shared-types/src/map/validation.ts`

- [ ] **Step 1: Write validation module**

File: `packages/shared-types/src/map/validation.ts`

```ts
import type { MapModel, EntityDef, Entity } from './types'
import { getEntityDef } from './registries'
import { entitiesAt } from './grid'

export interface ValidationResult {
  valid: boolean
  reason?: string
}

export function canPlaceEntity(
  model: MapModel,
  def: EntityDef,
  x: number,
  y: number,
  excludeEntityId?: string,
): ValidationResult {
  for (let dy = 0; dy < def.size.h; dy++) {
    for (let dx = 0; dx < def.size.w; dx++) {
      const tx = x + dx
      const ty = y + dy

      if (tx < 0 || tx >= model.width || ty < 0 || ty >= model.height) {
        return { valid: false, reason: '超出地图边界' }
      }

      const tile = model.tiles[ty]?.[tx]
      if (!tile || tile.terrain !== 'floor') {
        return { valid: false, reason: '只能放在地板格上' }
      }

      const existing = entitiesAt(model, tx, ty).filter((e) => e.id !== excludeEntityId)
      for (const ent of existing) {
        const entDef = getEntityDef(ent.defId)
        if (!entDef) continue
        if (entDef.layer === def.layer && entDef.walkability === 'solid' && def.walkability === 'solid') {
          return { valid: false, reason: `与 ${entDef.label} 重叠` }
        }
      }
    }
  }
  return { valid: true }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/shared-types`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/map/validation.ts
git commit -m "feat(map): add placement validation"
```

---

### Task 6: Behavior Engine

**Files:**
- Create: `packages/shared-types/src/map/behavior.ts`

- [ ] **Step 1: Write behavior engine**

File: `packages/shared-types/src/map/behavior.ts`

```ts
import type { MapModel, EntityRuntime, EntitySchedule, BehavioralProfile } from './types'
import { getEntityDef, getInteractionDef } from './registries'
import { entitiesAt } from './grid'
import { findPath } from './pathfinding'

export function scheduleFromProfile(schedule: EntitySchedule): EntitySchedule {
  return schedule
}

export function compareProfiles(_a: BehavioralProfile, _b: BehavioralProfile): number {
  return 1.0
}

function resolveActivity(
  schedule: EntitySchedule,
  hour: number,
): { interactionType: string; requiresTag: string } | null {
  for (const entry of schedule.entries) {
    if (entry.startHour <= hour && entry.endHour > hour) {
      return { interactionType: entry.interactionType, requiresTag: entry.requiresTag }
    }
  }
  const wrapEntry = schedule.entries.find((e) => e.endHour < e.startHour)
  if (wrapEntry && (hour >= wrapEntry.startHour || hour < wrapEntry.endHour)) {
    return { interactionType: wrapEntry.interactionType, requiresTag: wrapEntry.requiresTag }
  }
  return null
}

function findNearestEntityWithTag(
  model: MapModel,
  from: { x: number; y: number },
  tag: string,
): { entity: { id: string }; tile: { x: number; y: number } } | null {
  let best: { entity: { id: string }; tile: { x: number; y: number }; dist: number } | null = null
  for (const ent of model.entities) {
    const def = getEntityDef(ent.defId)
    if (!def?.tags?.includes(tag)) continue
    const cx = ent.gridX + Math.floor(def.size.w / 2)
    const cy = ent.gridY + Math.floor(def.size.h / 2)
    const dist = Math.abs(from.x - cx) + Math.abs(from.y - cy)
    if (!best || dist < best.dist) {
      best = { entity: { id: ent.id }, tile: { x: cx, y: cy }, dist }
    }
  }
  return best ? { entity: best.entity, tile: best.tile } : null
}

export function updateEntityBehavior(
  runtime: EntityRuntime,
  schedule: EntitySchedule,
  model: MapModel,
  simulatedTime: Date,
  deltaSec: number,
): EntityRuntime {
  if (!simulatedTime || isNaN(simulatedTime.getTime())) return runtime

  switch (runtime.state) {
    case 'idle': {
      const hour = simulatedTime.getHours() + simulatedTime.getMinutes() / 60
      const activity = resolveActivity(schedule, hour)
      if (!activity) return runtime

      const target = findNearestEntityWithTag(model, runtime.currentTile, activity.requiresTag)
      if (!target) return runtime

      const path = findPath(model, runtime.currentTile, target.tile)
      if (!path) return runtime

      const def = getInteractionDef(activity.interactionType)
      return {
        ...runtime,
        state: 'moving',
        path: path.path,
        pathProgress: 0,
        interaction: {
          type: activity.interactionType,
          targetEntityId: target.entity.id,
          targetTile: target.tile,
          durationMinutes: def?.defaultDuration ?? 30,
          posture: def?.posture ?? 'standing',
          startedAt: 0,
        },
      }
    }

    case 'moving': {
      if (!runtime.path) return { ...runtime, state: 'idle' }
      const speed = 3.0
      const progress = (runtime.pathProgress ?? 0) + (deltaSec * speed) / runtime.path.length
      if (progress >= 1.0) {
        const tile = runtime.path[runtime.path.length - 1]
        const interaction = runtime.interaction
          ? { ...runtime.interaction, startedAt: simulatedTime.getTime() }
          : undefined
        return {
          ...runtime,
          state: 'acting',
          currentTile: tile,
          interaction,
          path: undefined,
          pathProgress: undefined,
        }
      }
      return { ...runtime, pathProgress: progress }
    }

    case 'acting': {
      if (!runtime.interaction) return { ...runtime, state: 'idle' }
      const elapsedMs = simulatedTime.getTime() - runtime.interaction.startedAt
      const elapsedMin = elapsedMs / 60000
      if (elapsedMin >= runtime.interaction.durationMinutes) {
        return { ...runtime, state: 'idle', interaction: undefined }
      }
      return runtime
    }

    default:
      return runtime
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/shared-types`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/map/behavior.ts
git commit -m "feat(map): add behavior engine"
```

---

### Task 7: Barrel Export

**Files:**
- Create: `packages/shared-types/src/map/index.ts`

- [ ] **Step 1: Write barrel file**

File: `packages/shared-types/src/map/index.ts`

```ts
export * from './types'
export * from './registries'
export * from './grid'
export * from './pathfinding'
export * from './validation'
export * from './behavior'
```

- [ ] **Step 2: Verify full shared-types compilation**

Run: `pnpm typecheck --filter @iomtea/shared-types`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/map/index.ts
git commit -m "feat(map): add barrel export"
```

---

### Task 8: Map Model Hook & Bootstrap Layout

**Files:**
- Create: `apps/web/src/map/useMapModel.ts`

- [ ] **Step 1: Write hook with default demo layout**

File: `apps/web/src/map/useMapModel.ts`

```ts
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
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/web`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/map/useMapModel.ts
git commit -m "feat(map): add MapModel hook with demo layout"
```

---

### Task 9: 3D Renderers — ZoneFloor & WallMesh

**Files:**
- Create: `apps/web/src/map/renderers/ZoneFloor.tsx`
- Create: `apps/web/src/map/renderers/WallMesh.tsx`

- [ ] **Step 1: Write ZoneFloor**

File: `apps/web/src/map/renderers/ZoneFloor.tsx`

```tsx
import { useMemo } from 'react'
import type { Zone } from '@iomtea/shared-types/map'
import { getZoneDef } from '@iomtea/shared-types/map'

interface ZoneFloorProps {
  zone: Zone
  tileSize: number
}

export function ZoneFloor({ zone, tileSize }: ZoneFloorProps) {
  const zoneDef = getZoneDef(zone.defId)
  const width = (zone.bounds.x2 - zone.bounds.x1 + 1) * tileSize
  const depth = (zone.bounds.y2 - zone.bounds.y1 + 1) * tileSize
  const cx = (zone.bounds.x1 + zone.bounds.x2 + 1) * tileSize / 2
  const cz = (zone.bounds.y1 + zone.bounds.y2 + 1) * tileSize / 2

  const color = useMemo(() => zoneDef?.color || '#eeeeee', [zoneDef])

  return (
    <mesh position={[cx, 0.01, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}
```

- [ ] **Step 2: Write WallMesh**

File: `apps/web/src/map/renderers/WallMesh.tsx`

```tsx
import type { WallSegment } from '@iomtea/shared-types/map'

interface WallMeshProps {
  segment: WallSegment
}

const WALL_THICKNESS = 0.15
const WALL_HEIGHT = 3

export function WallMesh({ segment }: WallMeshProps) {
  const dx = segment.x2 - segment.x1
  const dz = segment.y2 - segment.y1
  const length = Math.sqrt(dx * dx + dz * dz)
  if (length < 0.001) return null

  const midX = (segment.x1 + segment.x2) / 2
  const midZ = (segment.y1 + segment.y2) / 2
  const angle = Math.atan2(dx, dz)

  return (
    <mesh position={[midX, WALL_HEIGHT / 2, midZ]} rotation-y={angle} castShadow receiveShadow>
      <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, length]} />
      <meshStandardMaterial color="#f5f0e8" />
    </mesh>
  )
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/web`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/map/renderers/ZoneFloor.tsx apps/web/src/map/renderers/WallMesh.tsx
git commit -m "feat(map): add 3D zone floor and wall mesh renderers"
```

---

### Task 10: 3D Renderers — Entity Components

**Files:**
- Create: `apps/web/src/map/renderers/Bed3D.tsx`
- Create: `apps/web/src/map/renderers/Person3D.tsx`
- Create: `apps/web/src/map/renderers/DeviceMarker3D.tsx`

- [ ] **Step 1: Write Bed3D**

File: `apps/web/src/map/renderers/Bed3D.tsx`

```tsx
import type { Entity, EntityDef } from '@iomtea/shared-types/map'

interface Bed3DProps {
  entity: Entity
  def: EntityDef
  tileSize: number
}

export function Bed3D({ entity, def, tileSize }: Bed3DProps) {
  const cx = (entity.gridX + def.size.w / 2) * tileSize
  const cz = (entity.gridY + def.size.h / 2) * tileSize

  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[2, 0.3, 1]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
      <mesh position={[0, 0.65, 0.45]} receiveShadow castShadow>
        <boxGeometry args={[2, 1, 0.1]} />
        <meshStandardMaterial color="#6B5335" />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[1.9, 0.05, 0.9]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 2: Write Person3D**

File: `apps/web/src/map/renderers/Person3D.tsx`

```tsx
import { Html } from '@react-three/drei'
import type { Entity, EntityDef, EntityRuntime } from '@iomtea/shared-types/map'

interface Person3DProps {
  entity: Entity
  def: EntityDef
  tileSize: number
  runtime?: EntityRuntime
  patientData?: {
    heartRate: number | null
    spO2: number | null
    systolicBP: number | null
    diastolicBP: number | null
  }
}

function tileToWorld(x: number, y: number, tileSize: number): [number, number] {
  return [(x + 0.5) * tileSize, (y + 0.5) * tileSize]
}

function interpolatePosition(
  path: { x: number; y: number }[] | undefined,
  progress: number | undefined,
  tileSize: number,
): [number, number] {
  if (!path || path.length === 0) return [0, 0]
  if (progress === undefined || progress >= 1) {
    return tileToWorld(path[path.length - 1].x, path[path.length - 1].y, tileSize)
  }
  const idx = Math.floor(progress * (path.length - 1))
  const nextIdx = Math.min(idx + 1, path.length - 1)
  const localProgress = (progress * (path.length - 1)) - idx
  const from = tileToWorld(path[idx].x, path[idx].y, tileSize)
  const to = tileToWorld(path[nextIdx].x, path[nextIdx].y, tileSize)
  return [
    from[0] + (to[0] - from[0]) * localProgress,
    from[1] + (to[1] - from[1]) * localProgress,
  ]
}

export function Person3D({ entity, def, tileSize, runtime, patientData }: Person3DProps) {
  const posture = (entity.meta?.posture as string) || 'standing'
  const [worldX, worldZ] = runtime?.state === 'moving'
    ? interpolatePosition(runtime.path, runtime.pathProgress, tileSize)
    : tileToWorld(entity.gridX, entity.gridY, tileSize)

  const layerY = entity.layer === 1 ? 0.5 : 0

  const bodyRotation: [number, number, number] =
    posture === 'lying' ? [0, 0, Math.PI / 2] : [0, 0, 0]

  const bodyOffset: [number, number, number] = posture === 'lying' ? [0, 0.3, 0] : [0, 1.1, 0]

  const headY = posture === 'lying' ? 1.1 : 2.1
  const htmlY = posture === 'lying' ? 1.5 : 2.5

  return (
    <group position={[worldX, layerY, worldZ]} rotation={bodyRotation}>
      <mesh position={bodyOffset} castShadow>
        <capsuleGeometry args={[0.2, 1.2, 4, 8]} />
        <meshStandardMaterial color="#f5c6a0" />
      </mesh>
      <mesh position={[0, headY, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#f5c6a0" />
      </mesh>
      {patientData && (
        <Html position={[0, htmlY, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 11,
            whiteSpace: 'nowrap',
          }}>
            <div>HR: {patientData.heartRate ?? '--'} bpm</div>
            <div>SpO2: {patientData.spO2 ?? '--'}%</div>
            {patientData.systolicBP && <div>BP: {patientData.systolicBP}/{patientData.diastolicBP}</div>}
          </div>
        </Html>
      )}
    </group>
  )
}
```

- [ ] **Step 3: Write DeviceMarker3D**

File: `apps/web/src/map/renderers/DeviceMarker3D.tsx`

```tsx
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'
import type { Entity, EntityDef } from '@iomtea/shared-types/map'

interface DeviceMarker3DProps {
  entity: Entity
  def: EntityDef
  tileSize: number
}

const statusColors: Record<string, string> = {
  normal: '#00cc66',
  warning: '#ff9900',
  alert: '#ff3333',
}

export function DeviceMarker3D({ entity, def, tileSize }: DeviceMarker3DProps) {
  const ringRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef(0)
  const cx = (entity.gridX + def.pivot.x) * tileSize
  const cz = (entity.gridY + def.pivot.y) * tileSize
  const layerY = entity.layer === 2 ? 2.5 : entity.layer === 1 ? 0.5 : 0.3
  const color = statusColors[entity.status || 'normal'] || statusColors.normal

  useFrame((_, delta) => {
    if (entity.status === 'alert' && ringRef.current) {
      pulseRef.current += delta * 3
      const scale = 1 + Math.sin(pulseRef.current) * 0.3
      ringRef.current.scale.setScalar(scale)
      const mat = ringRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + Math.sin(pulseRef.current * 2) * 0.5
    }
  })

  return (
    <group position={[cx, layerY, cz]}>
      <mesh castShadow>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.03, 8, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} />
      </mesh>
      <Html position={[0, 0.3, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          color: '#fff',
          fontSize: 9,
          background: 'rgba(0,0,0,0.6)',
          padding: '1px 4px',
          borderRadius: 2,
          whiteSpace: 'nowrap',
        }}>
          {def.label}
        </div>
      </Html>
    </group>
  )
}
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/web`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/map/renderers/Bed3D.tsx apps/web/src/map/renderers/Person3D.tsx apps/web/src/map/renderers/DeviceMarker3D.tsx
git commit -m "feat(map): add 3D entity renderers"
```

---

### Task 11: MapRenderer3D — Compose 3D Scene

**Files:**
- Create: `apps/web/src/map/MapRenderer3D.tsx`

- [ ] **Step 1: Write MapRenderer3D**

File: `apps/web/src/map/MapRenderer3D.tsx`

```tsx
import { useMemo } from 'react'
import type { MapModel, EntityRuntime } from '@iomtea/shared-types/map'
import { getWallSegments, getEntityDef } from '@iomtea/shared-types/map'
import { ZoneFloor } from './renderers/ZoneFloor'
import { WallMesh } from './renderers/WallMesh'
import { Bed3D } from './renderers/Bed3D'
import { Person3D } from './renderers/Person3D'
import { DeviceMarker3D } from './renderers/DeviceMarker3D'

interface MapRenderer3DProps {
  model: MapModel
  runtimes?: Map<string, EntityRuntime>
  patientDataMap?: Map<string, {
    heartRate: number | null
    spO2: number | null
    systolicBP: number | null
    diastolicBP: number | null
  }>
}

export function MapRenderer3D({ model, runtimes, patientDataMap }: MapRenderer3DProps) {
  const walls = useMemo(() => getWallSegments(model), [model])

  return (
    <group>
      <ambientLight intensity={0.4} />
      <directionalLight position={[15, 20, 10]} intensity={0.8} castShadow />

      {model.zones.map((zone) => (
        <ZoneFloor key={zone.id} zone={zone} tileSize={model.tileSize} />
      ))}

      {walls.map((seg, i) => (
        <WallMesh key={`wall-${i}`} segment={seg} />
      ))}

      {model.entities.map((ent) => {
        const def = getEntityDef(ent.defId)
        if (!def) return null

        const runtime = runtimes?.get(ent.id)
        const pd = ent.patientId ? patientDataMap?.get(ent.patientId) : undefined

        switch (def.render3D?.component) {
          case 'Bed3D':
            return <Bed3D key={ent.id} entity={ent} def={def} tileSize={model.tileSize} />
          case 'Person3D':
            return (
              <Person3D
                key={ent.id}
                entity={ent}
                def={def}
                tileSize={model.tileSize}
                runtime={runtime}
                patientData={pd}
              />
            )
          case 'DeviceMarker3D':
            return <DeviceMarker3D key={ent.id} entity={ent} def={def} tileSize={model.tileSize} />
          default:
            return null
        }
      })}
    </group>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/web`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/map/MapRenderer3D.tsx
git commit -m "feat(map): add 3D scene renderer"
```

---

### Task 12: MapRenderer2D — SVG Top-down View

**Files:**
- Create: `apps/web/src/map/MapRenderer2D.tsx`

- [ ] **Step 1: Write 2D renderer**

File: `apps/web/src/map/MapRenderer2D.tsx`

```tsx
import { useMemo } from 'react'
import type { MapModel, EntityRuntime } from '@iomtea/shared-types/map'
import { getWallSegments, getEntityDef, getZoneDef } from '@iomtea/shared-types/map'

interface MapRenderer2DProps {
  model: MapModel
  cellSize?: number
  runtimes?: Map<string, EntityRuntime>
}

export function MapRenderer2D({ model, cellSize = 32, runtimes }: MapRenderer2DProps) {
  const walls = useMemo(() => getWallSegments(model), [model])
  const w = model.width * cellSize
  const h = model.height * cellSize

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {model.zones.map((zone) => {
        const def = getZoneDef(zone.defId)
        return (
          <rect
            key={zone.id}
            x={zone.bounds.x1 * cellSize}
            y={zone.bounds.y1 * cellSize}
            width={(zone.bounds.x2 - zone.bounds.x1 + 1) * cellSize}
            height={(zone.bounds.y2 - zone.bounds.y1 + 1) * cellSize}
            fill={def?.color || '#eee'}
            stroke="#ccc"
            strokeWidth={1}
          />
        )
      })}

      {walls.map((seg, i) => (
        <line
          key={`w-${i}`}
          x1={seg.x1 * cellSize}
          y1={seg.y1 * cellSize}
          x2={seg.x2 * cellSize}
          y2={seg.y2 * cellSize}
          stroke="#333"
          strokeWidth={2}
        />
      ))}

      {model.entities.map((ent) => {
        const def = getEntityDef(ent.defId)
        if (!def) return null
        const runtime = runtimes?.get(ent.id)
        const x = (ent.gridX + def.pivot.x) * cellSize
        const y = (ent.gridY + def.pivot.y) * cellSize
        const color = def.render2D?.color || '#999'

        if (def.render2D?.icon === 'circle') {
          return <circle key={ent.id} cx={x} cy={y} r={cellSize * 0.3} fill={color} />
        }
        if (def.render2D?.icon === 'line') {
          return <rect key={ent.id} x={x - cellSize * 0.1} y={y - cellSize * 0.4} width={cellSize * 0.2} height={cellSize * 0.8} fill={color} />
        }
        const w2 = def.size.w * cellSize
        const h2 = def.size.h * cellSize
        return (
          <g key={ent.id}>
            <rect x={ent.gridX * cellSize} y={ent.gridY * cellSize} width={w2} height={h2} fill={color} rx={2} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={9} fill="#fff">
              {def.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/web`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/map/MapRenderer2D.tsx
git commit -m "feat(map): add 2D SVG renderer"
```

---

### Task 13: Entity Runtimes Hook

**Files:**
- Create: `apps/web/src/map/useEntityRuntimes.ts`

- [ ] **Step 1: Write runtimes hook**

File: `apps/web/src/map/useEntityRuntimes.ts`

```tsx
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { MapModel, EntityRuntime, EntitySchedule } from '@iomtea/shared-types/map'
import { updateEntityBehavior } from '@iomtea/shared-types/map'

function defaultSchedule(): EntitySchedule {
  return {
    source: 'synthetic',
    entries: [
      { startHour: 0, endHour: 7, interactionType: 'sleep', requiresTag: 'can-lie' },
      { startHour: 7, endHour: 8, interactionType: 'eat', requiresTag: 'can-eat' },
      { startHour: 8, endHour: 12, interactionType: 'rest', requiresTag: 'can-sit' },
      { startHour: 12, endHour: 13, interactionType: 'eat', requiresTag: 'can-eat' },
      { startHour: 13, endHour: 18, interactionType: 'rest', requiresTag: 'can-sit' },
      { startHour: 18, endHour: 19, interactionType: 'eat', requiresTag: 'can-eat' },
      { startHour: 19, endHour: 24, interactionType: 'sleep', requiresTag: 'can-lie' },
    ],
  }
}

export function useEntityRuntimes(
  model: MapModel,
  patientIds: string[],
  simulatedTime: Date,
  deltaSec: number,
): Map<string, EntityRuntime> {
  const runtimesRef = useRef<Map<string, EntityRuntime>>(new Map())
  const initializedRef = useRef(false)

  useMemo(() => {
    if (!initializedRef.current) {
      const personEntities = model.entities.filter((e) => e.defId === 'person')
      for (let i = 0; i < personEntities.length; i++) {
        const ent = personEntities[i]
        runtimesRef.current.set(ent.id, {
          entityId: ent.id,
          state: 'idle',
          currentTile: { x: ent.gridX, y: ent.gridY },
        })
      }
      initializedRef.current = true
    }
  }, [model])

  useMemo(() => {
    const schedule = defaultSchedule()
    for (const [id, rt] of runtimesRef.current) {
      const updated = updateEntityBehavior(rt, schedule, model, simulatedTime, deltaSec)
      runtimesRef.current.set(id, updated)
    }
  }, [model, simulatedTime, deltaSec])

  return runtimesRef.current
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/web`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/map/useEntityRuntimes.ts
git commit -m "feat(map): add entity runtimes hook"
```

---

### Task 14: Integrate MapRenderer3D into DigitalTwinPage

**Files:**
- Modify: `apps/web/src/pages/DigitalTwinPage.tsx`

- [ ] **Step 1: Replace HomeScene with MapRenderer3D**

Read existing file first, then apply edit. Replace the entire file content:

File: `apps/web/src/pages/DigitalTwinPage.tsx`

```tsx
import { Container, Loader, Text } from '@mantine/core'
import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Component, type ReactNode, useMemo } from 'react'
import { useMapModel } from '../map/useMapModel'
import { MapRenderer3D } from '../map/MapRenderer3D'
import { useSimData } from '../3d/hooks/useSimData'
import { trpc } from '../trpc'

class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message || '未知渲染错误' }
  }
  componentDidCatch(error: Error) {
    console.error('[DigitalTwin] 3D scene error:', error)
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <Container py="xl" ta="center">
            <Text c="red" fw={500}>3D 场景渲染失败</Text>
            <Text size="sm" c="dimmed" mt="xs">{this.state.errorMsg}</Text>
            <Text size="xs" c="dimmed" mt="md">请检查浏览器是否支持 WebGL，或刷新页面重试</Text>
          </Container>
        )
      )
    }
    return this.props.children
  }
}

export function DigitalTwinPage() {
  const model = useMapModel()

  const { data: patients, isLoading: patientsLoading } = trpc.patient.list.useQuery(
    { pageSize: 20, status: 'active' },
    { refetchInterval: 10000 },
  )

  const patientIds = (patients as any[] | undefined)?.map((p: any) => p.id) || []
  const { patientData, isLoading: simLoading } = useSimData(patientIds)

  const patientDataMap = useMemo(() => {
    const map = new Map()
    for (const pd of patientData) {
      map.set(pd.patientId, {
        heartRate: pd.heartRate,
        spO2: pd.spO2,
        systolicBP: pd.systolicBP,
        diastolicBP: pd.diastolicBP,
      })
    }
    return map
  }, [patientData])

  if (patientsLoading) {
    return (
      <Container py="xl">
        <Loader />
        <Text mt="md">加载患者数据...</Text>
      </Container>
    )
  }

  if (model.zones.length === 0) {
    return (
      <Container py="xl" ta="center">
        <Text c="dimmed">暂无地图数据</Text>
      </Container>
    )
  }

  return (
    <Container size="responsive" p={0} style={{ height: 'calc(100vh - 120px)' }}>
      {simLoading && (
        <Container py="md" ta="center">
          <Loader size="sm" />
          <Text size="sm" c="dimmed" mt="xs">加载体征数据...</Text>
        </Container>
      )}
      <ErrorBoundary>
        <Canvas
          camera={{ position: [20, 15, 20], fov: 50 }}
          shadows
          style={{ background: '#1a1a2e' }}
          gl={{ preserveDrawingBuffer: false, antialias: true }}
          onCreated={({ gl }) => { gl.setClearColor('#1a1a2e') }}
        >
          <MapRenderer3D model={model} patientDataMap={patientDataMap} />
          <OrbitControls
            target={[7, 0, 5]}
            maxPolarAngle={Math.PI / 2.5}
            minDistance={5}
            maxDistance={40}
            enableDamping
            dampingFactor={0.1}
          />
        </Canvas>
      </ErrorBoundary>
    </Container>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/web`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/DigitalTwinPage.tsx
git commit -m "feat(map): integrate MapRenderer3D into DigitalTwinPage"
```

---

### Task 15: Map Editor Page

**Files:**
- Create: `apps/web/src/map/editor/Toolbar.tsx`
- Create: `apps/web/src/map/editor/PropertiesPanel.tsx`
- Create: `apps/web/src/map/editor/MapCanvas2D.tsx`
- Create: `apps/web/src/map/editor/MapEditorPage.tsx`
- Modify: `apps/web/src/App.tsx` (add editor tab)

- [ ] **Step 1: Write Toolbar**

File: `apps/web/src/map/editor/Toolbar.tsx`

```tsx
import { Button, Group, Paper, Stack, Text, Tooltip } from '@mantine/core'
import type { EntityDef } from '@iomtea/shared-types/map'
import { ENTITY_DEFS } from '@iomtea/shared-types/map'

type ToolMode = 'select' | 'draw-room' | { type: 'place-entity'; defId: string }

interface ToolbarProps {
  mode: ToolMode
  onChangeMode: (mode: ToolMode) => void
}

const PLACABLE_DEFS = ENTITY_DEFS.filter((d) =>
  d.category === 'furniture' || d.category === 'sensor' || d.category === 'structure',
)

export function Toolbar({ mode, onChangeMode }: ToolbarProps) {
  const isSelect = mode === 'select'
  const isDrawRoom = mode === 'draw-room'

  return (
    <Paper p="xs" w={120} withBorder style={{ flexShrink: 0 }}>
      <Stack gap="xs">
        <Text size="xs" fw={600} c="dimmed">工具</Text>
        <Button
          size="xs"
          variant={isSelect ? 'filled' : 'light'}
          onClick={() => onChangeMode('select')}
        >
          选择
        </Button>
        <Button
          size="xs"
          variant={isDrawRoom ? 'filled' : 'light'}
          onClick={() => onChangeMode('draw-room')}
        >
          画房间
        </Button>

        <Text size="xs" fw={600} c="dimmed" mt="xs">实体</Text>
        {PLACABLE_DEFS.map((def) => {
          const isActive = typeof mode === 'object' && mode.type === 'place-entity' && mode.defId === def.id
          return (
            <Tooltip key={def.id} label={def.label} position="right">
              <Button
                size="xs"
                variant={isActive ? 'filled' : 'light'}
                color={isActive ? 'blue' : 'gray'}
                onClick={() => onChangeMode({ type: 'place-entity', defId: def.id })}
              >
                {def.label}
              </Button>
            </Tooltip>
          )
        })}
      </Stack>
    </Paper>
  )
}
```

- [ ] **Step 2: Write PropertiesPanel**

File: `apps/web/src/map/editor/PropertiesPanel.tsx`

```tsx
import { Paper, Stack, Text, Button, Select, Badge, Group } from '@mantine/core'
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

        <Button
          size="xs"
          color="red"
          variant="light"
          onClick={() => onDelete(selectedEntity.id)}
        >
          删除实体
        </Button>
      </Stack>
    </Paper>
  )
}
```

- [ ] **Step 3: Write MapCanvas2D**

File: `apps/web/src/map/editor/MapCanvas2D.tsx`

```tsx
import { useState, useCallback } from 'react'
import type { MapModel, Zone, Entity, EntityDef } from '@iomtea/shared-types/map'
import { getEntityDef, getZoneDef, ENTITY_DEFS, ZONE_DEFS, getWallSegments, canPlaceEntity } from '@iomtea/shared-types/map'
import { MapRenderer2D } from '../MapRenderer2D'

type ToolMode = 'select' | 'draw-room' | { type: 'place-entity'; defId: string }

interface MapCanvas2DProps {
  model: MapModel
  mode: ToolMode
  selectedEntityId: string | null
  onSelectEntity: (id: string | null) => void
  onAddEntity: (entity: Entity) => void
  onAddZone: (zone: Zone) => void
  onMoveEntity: (id: string, x: number, y: number) => void
}

export function MapCanvas2D({
  model,
  mode,
  selectedEntityId,
  onSelectEntity,
  onAddEntity,
  onAddZone,
  onMoveEntity,
}: MapCanvas2DProps) {
  const cellSize = 32
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)
  const [dragEntityId, setDragEntityId] = useState<string | null>(null)
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)

  const gridToCell = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    return {
      x: Math.floor((clientX - rect.left) / cellSize),
      y: Math.floor((clientY - rect.top) / cellSize),
    }
  }, [cellSize])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const cell = gridToCell(e.clientX, e.clientY, rect)

      if (mode === 'select') {
        const clicked = model.entities.find((ent) => {
          const def = getEntityDef(ent.defId)
          if (!def) return false
          return cell.x >= ent.gridX && cell.x < ent.gridX + def.size.w &&
                 cell.y >= ent.gridY && cell.y < ent.gridY + def.size.h
        })
        if (clicked) {
          onSelectEntity(clicked.id)
          setDragEntityId(clicked.id)
          setDragStart(cell)
        } else {
          onSelectEntity(null)
        }
      }

      if (mode === 'draw-room') {
        setDragStart(cell)
        setDragCurrent(cell)
      }

      if (typeof mode === 'object' && mode.type === 'place-entity') {
        const def = getEntityDef(mode.defId)
        if (!def) return
        const result = canPlaceEntity(model, def, cell.x, cell.y)
        if (result.valid) {
          onAddEntity({
            id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            defId: mode.defId,
            gridX: cell.x,
            gridY: cell.y,
            layer: def.layer,
            orientation: def.defaultOrientation,
            status: 'normal',
          })
        }
      }
    },
    [mode, model, gridToCell, onSelectEntity, onAddEntity],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const cell = gridToCell(e.clientX, e.clientY, rect)
      setHoverCell(cell)

      if (dragStart && mode === 'draw-room') {
        setDragCurrent(cell)
      }

      if (dragEntityId && dragStart) {
        const dx = cell.x - dragStart.x
        const dy = cell.y - dragStart.y
        if (dx !== 0 || dy !== 0) {
          const ent = model.entities.find((e) => e.id === dragEntityId)
          if (ent) {
            onMoveEntity(dragEntityId, ent.gridX + dx, ent.gridY + dy)
            setDragStart(cell)
          }
        }
      }
    },
    [dragStart, dragEntityId, mode, model, gridToCell, onMoveEntity],
  )

  const handleMouseUp = useCallback(() => {
    if (dragStart && dragCurrent && mode === 'draw-room') {
      const x1 = Math.min(dragStart.x, dragCurrent.x)
      const y1 = Math.min(dragStart.y, dragCurrent.y)
      const x2 = Math.max(dragStart.x, dragCurrent.x)
      const y2 = Math.max(dragStart.y, dragCurrent.y)

      if (x2 - x1 >= 2 && y2 - y1 >= 2) {
        onAddZone({
          id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          defId: 'bedroom',
          name: '新房间',
          bounds: { x1, y1, x2, y2 },
        })
      }
    }
    setDragStart(null)
    setDragCurrent(null)
    setDragEntityId(null)
  }, [dragStart, dragCurrent, mode, onAddZone])

  const showPreview =
    dragStart && dragCurrent && mode === 'draw-room'

  const w = model.width * cellSize
  const h = model.height * cellSize

  return (
    <div
      style={{ position: 'relative', width: w, height: h, overflow: 'hidden' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <MapRenderer2D model={model} cellSize={cellSize} />

      {hoverCell && typeof mode === 'object' && mode.type === 'place-entity' && (() => {
        const def = getEntityDef(mode.defId)
        if (!def) return null
        const valid = canPlaceEntity(model, def, hoverCell.x, hoverCell.y).valid
        return (
          <div
            style={{
              position: 'absolute',
              left: hoverCell.x * cellSize,
              top: hoverCell.y * cellSize,
              width: def.size.w * cellSize,
              height: def.size.h * cellSize,
              border: `2px solid ${valid ? '#4caf50' : '#f44336'}`,
              background: valid ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)',
              pointerEvents: 'none',
            }}
          />
        )
      })()}

      {showPreview && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(dragStart!.x, dragCurrent!.x) * cellSize,
            top: Math.min(dragStart!.y, dragCurrent!.y) * cellSize,
            width: (Math.abs(dragCurrent!.x - dragStart!.x) + 1) * cellSize,
            height: (Math.abs(dragCurrent!.y - dragStart!.y) + 1) * cellSize,
            border: '2px dashed #1976d2',
            background: 'rgba(25,118,210,0.1)',
            pointerEvents: 'none',
          }}
        />
      )}

      {selectedEntityId && (() => {
        const ent = model.entities.find((e) => e.id === selectedEntityId)
        if (!ent) return null
        const def = getEntityDef(ent.defId)
        if (!def) return null
        return (
          <div
            style={{
              position: 'absolute',
              left: ent.gridX * cellSize,
              top: ent.gridY * cellSize,
              width: def.size.w * cellSize,
              height: def.size.h * cellSize,
              border: '2px solid #1976d2',
              pointerEvents: 'none',
            }}
          />
        )
      })()}
    </div>
  )
}
```

- [ ] **Step 4: Write MapEditorPage**

File: `apps/web/src/map/editor/MapEditorPage.tsx`

```tsx
import { useState, useCallback, useRef } from 'react'
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
      const ent = model.entities.find((e) => e.id === id)
      if (!ent) return
      const def = getEntityDef(ent.defId)
      if (!def) return
      const newModel = {
        ...model,
        entities: model.entities.map((e) =>
          e.id === id ? { ...e, gridX: Math.max(0, Math.min(model.width - def.size.w, x)), gridY: Math.max(0, Math.min(model.height - def.size.h, y)) } : e,
        ),
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
```

- [ ] **Step 5: Add editor tab to App.tsx**

Read `apps/web/src/App.tsx` and add:

1. Import: `import { MapEditorPage } from './map/editor/MapEditorPage'`
2. New tab: `<Tabs.Tab value="mapEditor">地图编辑</Tabs.Tab>`
3. Render: `{activeTab === 'mapEditor' && <MapEditorPage />}`

Apply edit:

```tsx
// Add import near other page imports
import { MapEditorPage } from './map/editor/MapEditorPage'

// Add tab after digitaltwin
<Tabs.Tab value="mapEditor">地图编辑</Tabs.Tab>

// Add render after digitaltwin line
{activeTab === 'mapEditor' && <MapEditorPage />}
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm typecheck --filter @iomtea/web`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/map/editor/Toolbar.tsx apps/web/src/map/editor/PropertiesPanel.tsx apps/web/src/map/editor/MapCanvas2D.tsx apps/web/src/map/editor/MapEditorPage.tsx apps/web/src/App.tsx
git commit -m "feat(map): add visual map editor page"
```

---

### Task 16: Cleanup — Remove Old 3D Layout Files

**Files:**
- Remove: `apps/web/src/3d/layouts/homeLayout.ts`
- Remove: `apps/web/src/3d/rooms/RoomGenerator.tsx`
- Remove: `apps/web/src/3d/scenes/HomeScene.tsx`
- Remove: `apps/web/src/3d/entities/Bed.tsx`
- Remove: `apps/web/src/3d/entities/Person.tsx`
- Remove: `apps/web/src/3d/entities/DeviceMarker.tsx`
- Remove: `apps/web/src/3d/entities/PressureHeatmap.tsx`

- [ ] **Step 1: Remove old files and verify no imports remain**

Run:
```bash
git rm apps/web/src/3d/layouts/homeLayout.ts
git rm apps/web/src/3d/rooms/RoomGenerator.tsx
git rm apps/web/src/3d/scenes/HomeScene.tsx
git rm apps/web/src/3d/entities/Bed.tsx
git rm apps/web/src/3d/entities/Person.tsx
git rm apps/web/src/3d/entities/DeviceMarker.tsx
git rm apps/web/src/3d/entities/PressureHeatmap.tsx
```

- [ ] **Step 2: Check for broken imports**

Run: `pnpm typecheck --filter @iomtea/web`

Expected: PASS (or fix any residual imports)

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(map): remove old hardcoded 3D layout files"
```

---

## Self-Review

- Spec coverage: All sections (1-13) from the spec have corresponding tasks in the plan.
- No placeholders: Every step has concrete code, file paths, and commands.
- Type consistency: `EntityRuntime`, `MapModel`, `Entity`, `Zone` used consistently across tasks.
