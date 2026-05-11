# Map System Architecture Design

**Date**: 2026-05-11
**Status**: Approved
**Branch**: `feature/system-enhancements`

## Overview

重构 IOMTea 的场景/地图系统，参考 Prison Architect 的多层架构思想，实现：

1. **逻辑-视图分离** — 同一份 `MapModel` 数据驱动 2D 和 3D 两种渲染
2. **跨端共享** — 核心类型放入 `packages/shared-types`，Web 和小程序共用
3. **预留寻路** — A* 寻路接口，用于未来的实体移动动画
4. **可视化编辑器** — 仿游戏体验的拖拽式地图编辑
5. **扩展性** — 注册表模式替代硬编码枚举，按标签驱动实体交互

---

## 1. Data Model — Three Layers

All types in `packages/shared-types/src/map/types.ts`.

### 1.1 GridLayer — Terrain / Walkability

The smallest indivisible unit. Each tile answers one question: "Can something walk here?"

```ts
interface Tile {
  terrain: 'floor' | 'void'
  // floor = walkable, void = not walkable (outside any room)
  // Walls are NOT tiles. Walls exist on edges between tiles.
}
```

**Key design**: Walls live in StructureLayer as edge segments, not as tile types. A `TILE_SIZE` thick wall is avoided — wall thickness (e.g., 0.15m) is a rendering concern only.

### 1.2 ZoneLayer — Room Regions

```ts
interface ZoneDef {
  id: string                     // "bedroom", "livingroom"...
  label: string                  // "卧室", "客厅"...
  color: string                  // Zone fill color in editor
  defaultSize?: { w: number; h: number }
  requirements?: {
    minSize?: number
    entities?: { defId: string; min: number }[]
    enclosed?: boolean
  }
}

interface Zone {
  id: string
  defId: string                  // References ZoneDef.id
  name: string                   // User-given name
  bounds: { x1: number; y1: number; x2: number; y2: number }
}
```

Zones do not overlap. Any tile outside all zones is `void`.

### 1.3 ObjectLayer — Entities (Registration-table pattern)

```ts
interface EntityDef {
  id: string                     // "bed", "person", ...
  label: string
  category: 'furniture' | 'actor' | 'sensor' | 'marker' | 'structure'
  size: { w: number; h: number }  // Grid cells occupied (orientation does NOT change this)
  layer: 0 | 1 | 2               // 0=floor, 1=surface, 2=wall-mount
  walkability: 'solid' | 'passable' | 'dynamic'
  pivot: { x: number; y: number } // Render pivot (0-1, default 0.5)
  defaultOrientation: 'N' | 'S' | 'E' | 'W'
  tags?: string[]                 // Interaction tags: ['can-lie', 'can-sit', 'monitors-hr']
  render2D?: { icon: string; color: string }
  render3D?: { component: string }
}

interface Entity {
  id: string
  defId: string                  // References EntityDef.id
  gridX: number; gridY: number   // Top-left corner of occupied area
  layer: number                  // Instance layer (defaults to def.layer)
  orientation: 'N' | 'S' | 'E' | 'W'  // Visual only, does NOT change footprint
  patientId?: string
  status?: 'normal' | 'warning' | 'alert'
  meta?: Record<string, unknown> // Free-form: { posture: 'lying' }, { open: true }
}
```

**Key design decisions**:
- Entity types use a registration table (`EntityDef[]`) not string enums. Adding new types = adding entries.
- Orientation does NOT swap footprint size. A 2×1 bed always occupies 2×1 cells.
- No `parentId`. No hard entity relationships. Furniture interactions use tags.

### 1.4 StructureLayer — Walls/Doors/Windows (Edge-based)

```ts
interface WallSegment {
  x1: number; y1: number; x2: number; y2: number  // World coords (meters)
  type: 'wall' | 'door' | 'window'
}
```

WallSegments are **derived data** (not serialized). They sit on tile **edges**, not inside tiles.

**Derivation rules**:
1. Any tile edge between `floor` and `void` → `wall` segment
2. Door/window entities (category='structure') suppress wall segments at their position

**Thickness**: 0.15m in 3D, 2px in 2D. Controlled entirely by the renderer.

### 1.5 MapModel — Aggregate Root

```ts
interface MapModel {
  id: string
  width: number; height: number     // Grid dimensions
  tileSize: number                  // World size per cell (default 1.0)
  tiles: Tile[][]                  // [y][x], derived from zones
  zones: Zone[]
  entities: Entity[]
}
```

---

## 2. Grid Generation & Wall Derivation

### 2.1 From Zones to Tiles

```
1. Initialize width×height Tile[][] all as { terrain: 'void' }
2. For each Zone: set tiles in bounds to { terrain: 'floor' }
```

### 2.2 Wall Segment Derivation

```
For each adjacent tile pair (t1, t2):
  If t1.terrain='floor' AND t2.terrain='void'
    → generate WallSegment on the shared edge
```

Door/window entities suppress intersecting wall segments.

### 2.3 Walkability Calculation

```ts
// Get all entities that occupy tile (x, y)
function entitiesAt(model: MapModel, x: number, y: number): Entity[] {
  return model.entities.filter(ent => {
    const def = getEntityDef(ent.defId)
    if (x < ent.gridX || x >= ent.gridX + def.size.w) return false
    if (y < ent.gridY || y >= ent.gridY + def.size.h) return false
    return true
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

**Rule**: One `solid` entity on any layer makes the entire cell unwalkable.

---

## 3. Layer System (Lightweight Z-axis)

Three layers per cell, collision-isolated:

| Layer | Name | Examples |
|---|---|---|
| 0 | Floor | bed, table, cabinet, standing person |
| 1 | Surface | person lying on bed, items on table |
| 2 | Wall-mount | sensors, TV, emergency button |

- Entities on different layers never collide
- Only `solid` entities on the same layer conflict
- `passable` entities can coexist with anything

### 3.1 Tag-Driven Interaction (Entity-side logic)

Furniture only carries passive `tags`. Actor entities detect tags and change their own state:

```
bed.tags = ['can-lie']
    ↓ (person entity arrives at bed’s tile)
person.meta.posture = 'lying'
person.layer = 1
```

Furniture has zero awareness of who is using it. The entity is fully responsible for its own state transitions.

### 3.2 Pathfinding Preference

When an entity has a need (e.g., `meta.needsRest`), pathfinding reduces traversal cost for tiles containing matching furniture:

```ts
function tileCost(entity, model, x, y): number {
  let cost = 1.0
  for (const other of entitiesAt(model, x, y)) {
    const def = getEntityDef(other.defId)
    if (entity.meta?.needsRest && def.tags?.includes('can-lie')) cost *= 0.5
  }
  return cost
}
```

---

## 4. Pathfinding Interface (A* Stub)

In `packages/shared-types/src/map/pathfinding.ts`:

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
    entity?: Entity              // for cost preferences
  },
): PathResult | null             // null = no path
```

Standard A*: priority queue ordered by `f = g + h`, where `h` is Manhattan distance.

---

## 5. Dual Renderers

Same `MapModel` → two rendering targets.

### 5.1 2D Renderer — SVG Top-Down (Web) / Canvas (Miniapp)

```tsx
function MapRenderer2D({ model, patientData }: MapRenderer2DProps) {
  // Layers:
  // 1. Zone fill rectangles (colored by zone def)
  // 2. Wall segments (thin lines, 2px)
  // 3. Entity icons (circles/rects by def.render2D)
}
```

In miniapp: same logic, rendered via `Taro.createCanvasContext`.

### 5.2 3D Renderer — R3F Canvas (Web only)

```tsx
function MapRenderer3D({ model, patientData }: MapRenderer3DProps) {
  // Layers:
  // 1. Zone floors (PlaneGeometry per zone)
  // 2. Wall meshes (thin BoxGeometry along edges, 0.15m thick × 3m tall)
  // 3. Entity meshes (by def.render3D.component lookup)
}
```

### 5.3 Existing Component Migration

| Old Component | New Component | Change |
|---|---|---|
| `RoomGenerator(layout)` | `ZoneFloor({ zone, tileSize })` | zone.bounds → floor plane |
| `Bed({ position, pressureGrid })` | `Bed3D({ entity, def, pd, tileSize })` | position from gridX/gridY |
| `Person({ position, posture, vitals })` | `Person3D({ entity, def, pd, tileSize })` | same pattern |
| `DeviceMarker({ position, label, status })` | `DeviceMarker3D({ entity, def, tileSize })` | same pattern |

---

## 6. Visual Editor (MapEditorPage)

### 6.1 Layout

```
┌──────────────────────────────────────────────┐
│  Toolbar: [Select] [Draw Room] [Bed] [...]   │
├─────────────────────────┬────────────────────┤
│                         │                    │
│  2D Canvas (SVG grid)   │  Properties Panel  │
│  - Drag to draw zones   │  - Selected entity │
│  - Click to place       │  - Position/orient │
│  - Drag to move         │  - Patient binding │
│                         │                    │
├─────────────────────────┴────────────────────┤
│  Status: (5,3) | Room: 主卧 | Entities: 12   │
└──────────────────────────────────────────────┘
```

### 6.2 Tool Modes

| Mode | Behavior |
|---|---|
| `select` | Click entity → select. Drag → move. Delete key → remove. Click blank → deselect. |
| `draw-room` | Drag rectangle → create zone. Preview shows semi-transparent fill. |
| `place-entity:{defId}` | Click grid → place entity. R key → rotate. Preview green/red for valid/invalid. |

### 6.3 Validation

`canPlaceEntity()` checks: within bounds, on floor tile, no same-layer solid overlap.

### 6.4 Serialization

Serialize only `{ id, width, height, zones, entities }`. Do NOT serialize `tiles` or `WallSegments` (they are derived).

---

## 7. Built-in Registries

### 7.1 EntityDefs (default)

| defId | category | layer | size | walkability | tags |
|---|---|---|---|---|---|
| bed | furniture | 0 | 2×1 | solid | can-lie |
| table | furniture | 0 | 2×1 | solid | — |
| cabinet | furniture | 0 | 1×1 | solid | — |
| toilet | furniture | 0 | 1×1 | solid | — |
| sofa | furniture | 0 | 2×1 | solid | can-sit |
| person | actor | 0 | 1×1 | passable | — |
| mattress_sensor | sensor | 2 | 1×1 | passable | — |
| air_sensor | sensor | 2 | 1×1 | passable | — |
| emergency_btn | marker | 2 | 1×1 | passable | — |
| motion_sensor | sensor | 2 | 1×1 | passable | — |
| tv | furniture | 2 | 1×1 | passable | — |
| door | structure | 0 | 1×1 | dynamic | — |
| window | structure | 0 | 1×1 | solid | — |

### 7.2 ZoneDefs (default)

| defId | label | color |
|---|---|---|
| bedroom | 卧室 | #e8f5e9 |
| livingroom | 客厅 | #fff3e0 |
| kitchen | 厨房 | #fce4ec |
| bathroom | 卫浴 | #e3f2fd |
| hall | 走廊 | #f5f5f5 |
| custom | 自定义 | #eeeeee |

---

## 8. File Structure

```
packages/shared-types/src/map/
  ├── types.ts             # MapModel, Tile, Zone, Entity, EntityDef, ZoneDef
  ├── registries.ts        # Built-in ENTITY_DEFS, ZONE_DEFS
  ├── grid.ts              # buildGrid(), getWallSegments(), isWalkable()
  ├── pathfinding.ts       # findPath() A* interface
  └── validation.ts        # canPlaceEntity()

apps/web/src/map/
  ├── useMapModel.ts       # React hook (trpc fetch + deserialize)
  ├── MapRenderer2D.tsx    # SVG 2D renderer
  ├── MapRenderer3D.tsx    # R3F 3D renderer
  ├── editor/
  │   ├── MapEditorPage.tsx    # Editor page (toolbar + canvas + panel)
  │   ├── MapCanvas2D.tsx      # Editable 2D canvas
  │   ├── Toolbar.tsx          # Tool mode selector
  │   └── PropertiesPanel.tsx  # Selected entity properties
  └── renderers/
      ├── ZoneFloor.tsx        # 3D zone floor
      ├── WallMesh.tsx         # 3D wall segment (0.15m thick)
      ├── Bed3D.tsx            # Migrated Bed component
      ├── Person3D.tsx         # Migrated Person component
      └── DeviceMarker3D.tsx   # Migrated DeviceMarker component
```

---

## 9. Implementation Phases

| Phase | Scope |
|---|---|
| **P1** | `shared-types/map/*` — types, registries, grid, pathfinding stub |
| **P2** | `MapRenderer3D` — replaces existing `HomeScene`, all existing 3D entities |
| **P3** | `MapRenderer2D` — SVG top-down view in Web |
| **P4** | `MapEditorPage` — drag-to-draw zones, click-to-place entities |
| **P5** | Migration — remove old `homeLayout.ts`, `RoomGenerator`, old entity components |
| **P6** | Miniapp 2D Canvas renderer |

---

## 10. Bootstrap: From Old Layout to New MapModel

A factory function converts the old hardcoded `homeLayout` (RoomLayout[] with grid tiles) into the new `MapModel` format, providing backward compatibility during migration:

```ts
// packages/shared-types/src/map/bootstrap.ts
function migrateFromHomeLayout(): MapModel {
  // 1. Derive zones from old RoomLayout names and bounds
  // 2. Derive entities from old AnchorDef positions
  // 3. Call buildGrid() to generate tiles and walls
  return model
}
```

Once the editor is available, the old layout is removed entirely.

