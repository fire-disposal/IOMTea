# Map System Architecture Design

**Date**: 2026-05-11
**Status**: Approved
**Branch**: `feature/system-enhancements`

## Overview

重构 IOMTea 的场景/地图系统，参考 Prison Architect 多层架构，实现逻辑-视图分离、跨端共享、寻路预留、可视化编辑器、数字孪生行为模拟。

| 目标 | 说明 |
|---|---|
| 逻辑-视图分离 | 同一 `MapModel` → 2D SVG + 3D R3F |
| 跨端共享 | 核心类型在 `packages/shared-types`，Web + 小程序 |
| 预留寻路 | A* 接口，实体移动动画 |
| 可视化编辑器 | 拖拽画房间、点击放实体 |
| 扩展性 | 注册表去枚举，标签驱动交互 |
| 数字孪生行为 | 三态状态机 + 交互系统 + 行为指纹 |

---

## 1. Data Model

All types in `packages/shared-types/src/map/types.ts`.

### 1.1 GridLayer — Terrain

```ts
interface Tile {
  terrain: 'floor' | 'void'
}
```

Walls are NOT tiles. They are edge segments (Section 1.4). Wall thickness (0.15m) is a rendering concern.

### 1.2 ZoneLayer — Room Regions

```ts
interface ZoneDef {
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

interface Zone {
  id: string
  defId: string
  name: string
  bounds: { x1: number; y1: number; x2: number; y2: number }
}
```

Zones do not overlap. Tiles outside all zones are `void`.

### 1.3 ObjectLayer — Entities (Registration-table)

```ts
interface EntityDef {
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

interface Entity {
  id: string
  defId: string
  gridX: number; gridY: number
  layer: number
  orientation: 'N' | 'S' | 'E' | 'W'  // visual only, footprint unchanged
  patientId?: string
  status?: 'normal' | 'warning' | 'alert'
  meta?: Record<string, unknown>
}
```

- Orientation does NOT swap footprint. 2×1 bed always occupies 2×1.
- No `parentId`. No hard entity relationships.
- New entity types = add entry to `EntityDef[]`.

### 1.4 StructureLayer — Walls (Edge-based)

```ts
interface WallSegment {
  x1: number; y1: number; x2: number; y2: number
  type: 'wall' | 'door' | 'window'
}
```

**Derived data** (not serialized). Exists on tile **edges**. Derivation:

```
1. Any edge between floor and void → wall segment
2. Door/window entities (category='structure') suppress intersecting segments
```

Thickness: 0.15m (3D) / 2px (2D). Renderer-only concern.

### 1.5 MapModel — Aggregate Root

```ts
interface MapModel {
  id: string
  width: number; height: number
  tileSize: number
  tiles: Tile[][]
  zones: Zone[]
  entities: Entity[]
}
```

---

## 2. Grid Generation & Walkability

### 2.1 From Zones to Tiles

```
1. Initialize width×height Tile[][] → all { terrain: 'void' }
2. Each Zone → set tiles in bounds → { terrain: 'floor' }
```

### 2.2 Walkability

```ts
function entitiesAt(model: MapModel, x: number, y: number): Entity[] {
  return model.entities.filter(ent => {
    const def = getEntityDef(ent.defId)
    return x >= ent.gridX && x < ent.gridX + def.size.w
        && y >= ent.gridY && y < ent.gridY + def.size.h
  })
}

function isWalkable(model, x, y): boolean {
  const tile = model.tiles[y]?.[x]
  if (!tile || tile.terrain === 'void') return false
  for (const ent of entitiesAt(model, x, y)) {
    const def = getEntityDef(ent.defId)
    if (def.walkability === 'solid') return false
    if (def.walkability === 'dynamic' && ent.meta?.open === false) return false
  }
  return true
}
```

Rule: one `solid` on any layer → cell unwalkable.

---

## 3. Layer System (Lightweight Z-axis)

| Layer | Name | Examples |
|---|---|---|
| 0 | Floor | bed, table, standing person |
| 1 | Surface | person on bed, items on table |
| 2 | Wall-mount | sensors, TV, emergency button |

- Different layers never collide
- Same-layer `solid` entities conflict on placement
- `passable` coexists with anything

### 3.1 Tag-Driven Interaction

Furniture carries passive `tags`. Actors detect and self-modify. Furniture is unaware.

```
bed.tags = ['can-lie']
  → person arrives at bed's tile
  → person.meta.posture = 'lying'
  → person.layer = 1
```

---

## 4. Entity Behavior System

In `packages/shared-types/src/map/behavior.ts`. Pure functions, no framework dependency.

### 4.1 Three-State Machine

Only motion-states. "resting/eating" are `acting` with a specific interaction target.

```ts
type EntityState = 'idle' | 'moving' | 'acting'
```

### 4.2 Interaction Definition

```ts
interface InteractionDef {
  type: string
  label: string
  requiresTag: string
  posture: 'standing' | 'sitting' | 'lying'
  defaultDuration: number
}

interface Interaction {
  type: string
  targetEntityId?: string
  targetTile: { x: number; y: number }
  durationMinutes: number
  posture: 'standing' | 'sitting' | 'lying'
  startedAt: number
}

const INTERACTION_DEFS: InteractionDef[] = [
  { type: 'sleep',  label: '睡眠', requiresTag: 'can-lie', posture: 'lying',    defaultDuration: 480 },
  { type: 'rest',   label: '休息', requiresTag: 'can-sit', posture: 'sitting',  defaultDuration: 60 },
  { type: 'eat',    label: '用餐', requiresTag: 'can-eat', posture: 'sitting',  defaultDuration: 30 },
]
```

### 4.3 Entity Runtime

```ts
interface EntityRuntime {
  entityId: string
  state: EntityState
  currentTile: { x: number; y: number }

  // moving
  path?: { x: number; y: number }[]
  pathProgress?: number

  // acting
  interaction?: Interaction
}
```

### 4.4 Behavior Engine

```ts
function updateEntityBehavior(
  runtime: EntityRuntime,
  schedule: EntitySchedule,
  model: MapModel,
  simulatedTime: Date,
  deltaSec: number,
): EntityRuntime
```

State transitions:

```
idle → (schedule active + tag found) → compute_path → moving
moving → (path complete) → start_interaction → acting
acting → (duration elapsed) → idle
moving → (cancel override) → idle
```

### 4.5 Behavior Events (Audit Log)

```ts
interface BehaviorEvent {
  timestamp: number; entityId: string
  type: 'zone_enter' | 'zone_exit' | 'interaction_start' | 'interaction_end' | 'state_change'
  zoneId?: string; interactionType?: string
}
```

Emitted every tick. Accumulated logs directly aggregate into `BehavioralProfile` (Section 6).

---

## 5. Entity Schedule

```ts
interface ScheduleEntry {
  startHour: number; endHour: number
  interactionType: string             // "sleep", "eat", "free"...
  requiresTag: string
}

interface EntitySchedule {
  entries: ScheduleEntry[]
  source: 'synthetic' | 'observed'
}
```

Two sources, no merging, no override priority:

```ts
// Source A: from PatientProfile baseline (current)
function scheduleFromProfile(profile: PatientProfile): EntitySchedule

// Source B: from observed behavioral data (future)
function scheduleFromBehavior(bp: BehavioralProfile): EntitySchedule
```

Switching is replacing `source`. Both produce the same `EntitySchedule` shape.

---

## 6. Behavioral Profile (Digital Twin Fingerprint)

Same structure for virtual output and real observation. Bridges the two data sources.

```ts
interface BehavioralProfile {
  zoneDwell: Record<string, { meanMin: number; stdMin: number }>
  interactions: Record<string, { perDay: number; typicalMin: number }>
  activityByHour: number[]
}
```

### 6.1 Production Pipeline

```
Virtual entity runs → BehaviorEvent[] → aggregate → BehavioralProfile (virtual)
Real sensors     → observation data  → aggregate → BehavioralProfile (observed)

compareProfiles(virtual, observed) → similarity score
```

### 6.2 Interfaces (stubs for now)

```ts
function compareProfiles(a: BehavioralProfile, b: BehavioralProfile): number
  // returns 0-1 similarity. Implementation deferred.

function scheduleFromBehavior(bp: BehavioralProfile): EntitySchedule
  // converts observed profile to schedule. Implementation deferred.
```

---

## 7. Pathfinding (A*)

In `packages/shared-types/src/map/pathfinding.ts`.

```ts
interface PathResult {
  path: { x: number; y: number }[]
  cost: number
  explored: number
}

function findPath(
  model: MapModel,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts?: {
    maxIterations?: number       // default 10000
    entity?: EntityRuntime       // for cost preferences (furniture tags)
  },
): PathResult | null
```

Standard A*: `f = g + h`, Manhattan heuristic. Can incorporate tag-based tile cost preferences.

---

## 8. Dual Renderers

### 8.1 2D — SVG (Web) / Canvas (Miniapp)

```tsx
function MapRenderer2D({ model, runtimes }: MapRenderer2DProps) {
  // 1. Zone fill (colored rectangles)
  // 2. Wall segments (2px lines)
  // 3. Entity icons (by def.render2D, positioned via EntityRuntime)
}
```

### 8.2 3D — R3F (Web only)

```tsx
function MapRenderer3D({ model, runtimes, patientData }: MapRenderer3DProps) {
  // 1. Zone floors (PlaneGeometry per zone bounds)
  // 2. Wall meshes (thin BoxGeometry 0.15m × 3m along edges)
  // 3. Entity meshes (by def.render3D.component, animated via EntityRuntime)
}
```

### 8.3 Component Migration

| Old | New | Change |
|---|---|---|
| `RoomGenerator(layout)` | `ZoneFloor({ zone, tileSize })` | zone.bounds → plane |
| `Bed({ position, grid })` | `Bed3D({ entity, def, runtime, tileSize })` | position from runtime |
| `Person({ position, posture })` | `Person3D({ entity, def, runtime, tileSize })` | animated by runtime |
| `DeviceMarker({ position })` | `DeviceMarker3D({ entity, def, tileSize })` | same pattern |

---

## 9. Visual Editor

```
┌──────────────────────────────────────────────┐
│  Toolbar: [Select] [Draw Room] [Bed] [...]   │
├─────────────────────────┬────────────────────┤
│  2D Canvas (SVG grid)   │  Properties Panel  │
│  - Drag → draw zone     │  Entity details    │
│  - Click → place entity │  Position/orient   │
│  - Drag → move entity   │  Patient binding   │
├─────────────────────────┴────────────────────┤
│  Status: (5,3) | Room: 主卧 | Entities: 12   │
└──────────────────────────────────────────────┘
```

| Mode | Behavior |
|---|---|
| `select` | Click select, drag move, Delete remove |
| `draw-room` | Drag rectangle → create zone |
| `place-entity:{defId}` | Click grid → place. R = rotate. Green/red preview |

### 9.1 Placement Validation

`canPlaceEntity()`: within bounds, on floor tile, no same-layer solid overlap.

### 9.2 Serialization

Store only `{ id, width, height, zones, entities }`. `tiles` and `WallSegments` are derived.

---

## 10. Built-in Registries

### 10.1 EntityDefs

| defId | category | layer | size | walkability | tags |
|---|---|---|---|---|---|
| bed | furniture | 0 | 2×1 | solid | can-lie |
| table | furniture | 0 | 2×1 | solid | can-eat |
| sofa | furniture | 0 | 2×1 | solid | can-sit |
| cabinet | furniture | 0 | 1×1 | solid | — |
| toilet | furniture | 0 | 1×1 | solid | — |
| person | actor | 0 | 1×1 | passable | — |
| mattress_sensor | sensor | 2 | 1×1 | passable | — |
| air_sensor | sensor | 2 | 1×1 | passable | — |
| emergency_btn | marker | 2 | 1×1 | passable | — |
| motion_sensor | sensor | 2 | 1×1 | passable | — |
| tv | furniture | 2 | 1×1 | passable | — |
| door | structure | 0 | 1×1 | dynamic | — |
| window | structure | 0 | 1×1 | solid | — |

### 10.2 ZoneDefs

| defId | label | color |
|---|---|---|
| bedroom | 卧室 | #e8f5e9 |
| livingroom | 客厅 | #fff3e0 |
| kitchen | 厨房 | #fce4ec |
| bathroom | 卫浴 | #e3f2fd |
| hall | 走廊 | #f5f5f5 |
| custom | 自定义 | #eeeeee |

---

## 11. File Structure

```
packages/shared-types/src/map/
  ├── types.ts             # Tile, Zone, ZoneDef, Entity, EntityDef, MapModel,
  │                        #   EntityState, EntityRuntime, Interaction, InteractionDef,
  │                        #   ScheduleEntry, EntitySchedule, BehavioralProfile
  ├── registries.ts        # ENTITY_DEFS, ZONE_DEFS, INTERACTION_DEFS
  ├── grid.ts              # buildGrid(), getWallSegments(), entitiesAt(), isWalkable()
  ├── pathfinding.ts       # findPath()
  ├── behavior.ts          # updateEntityBehavior(), compareProfiles() stub,
  │                        #   scheduleFromProfile(), scheduleFromBehavior() stub
  └── validation.ts        # canPlaceEntity()

apps/web/src/map/
  ├── useMapModel.ts       # React hook
  ├── useEntityRuntimes.ts # Hook running behavior engine each frame
  ├── MapRenderer2D.tsx
  ├── MapRenderer3D.tsx
  ├── editor/
  │   ├── MapEditorPage.tsx
  │   ├── MapCanvas2D.tsx
  │   ├── Toolbar.tsx
  │   └── PropertiesPanel.tsx
  └── renderers/
      ├── ZoneFloor.tsx
      ├── WallMesh.tsx
      ├── Bed3D.tsx
      ├── Person3D.tsx
      └── DeviceMarker3D.tsx
```

---

## 12. Implementation Phases

| Phase | Scope |
|---|---|
| **P1** | `shared-types/map/*` — all types, registries, grid, pathfinding stub, behavior types |
| **P2** | `MapRenderer3D` — replaces `HomeScene`, all existing 3D entities |
| **P3** | `MapRenderer2D` — SVG top-down view |
| **P4** | `behavior.ts` — full engine, `useEntityRuntimes` hook |
| **P5** | `MapEditorPage` — drag-draw zones, click-place entities |
| **P6** | Migration — remove `homeLayout.ts`, `RoomGenerator`, old components |
| **P7** | Miniapp 2D Canvas renderer |

---

## 13. Bootstrap: Old Layout → New MapModel

Factory converts hardcoded `homeLayout` to `MapModel` for backward compatibility. Removed once editor is available.

```ts
function migrateFromHomeLayout(): MapModel
```
