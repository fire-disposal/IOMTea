# 居家地图子系统 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 构建 RimWorld 风格的 2D Tile-Entity 居家地图系统，支持户型模板生成、编辑器绘制、房间自动检测、Thing 放置、设备绑定、健康数据耦合。

**Architecture:** shared-types 包承载纯函数模型（grid/room detection/pathfinding），server 提供 tRPC CRUD + ingest enrichment 管道，web 提供 2D Canvas 编辑器 + 展示视口。Flutter 端提供设备安装时的 Thing 绑定接口。

**Tech Stack:** TypeScript, Drizzle ORM, Hono/tRPC, React + Canvas 2D, Biome

---

## 0. 数据结构优化（预先设计）

### 0.1 TileGrid 紧凑存储

```typescript
// —— 运行时展开 ——
// Tile 仅 4 种状态，用 2 bit 表达
export const enum TileFlag {
  VOID    = 0b00,  // 不可走、无墙
  FLOOR   = 0b01,  // 可走、无墙
  WALL    = 0b10,  // 不可走、有墙
  DOOR    = 0b11,  // 可走、门
}

// —— 序列化（DB / API） ——
// 100x100 grid = 10,000 tiles = 2,500 字节（Uint8Array packed）
// 比 JSON 数组 [][{flag},{flag},...] 缩小约 95%
export type PackedGrid = string  // base64 编码的 Uint8Array

export function packGrid(flags: TileFlag[][]): PackedGrid {
  // 二维→一维 Uint8Array (2bit/tile) → base64
  const h = flags.length, w = flags[0].length
  const buf = new Uint8Array(Math.ceil((w * h * 2) / 8) + 2)
  buf[0] = w; buf[1] = h  // header: width, height
  let bitIdx = 16
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = flags[y][x]
      buf[bitIdx >> 3] |= v << (bitIdx & 7)
      bitIdx += 2
    }
  return btoa(String.fromCharCode(...buf))
}

export function unpackGrid(packed: PackedGrid): TileFlag[][] {
  const buf = Uint8Array.from(atob(packed), c => c.charCodeAt(0))
  const w = buf[0], h = buf[1]
  const result: TileFlag[][] = Array.from({ length: h }, () => Array(w).fill(TileFlag.FLOOR))
  let bitIdx = 16
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      result[y][x] = (buf[bitIdx >> 3] >> (bitIdx & 7)) & 0b11
      bitIdx += 2
    }
  return result
}

// —— 运行时查询缓存 ——
// rooms / pathfinding 高频读取，在内存中保持展开态
// 只在 load/save 时 pack/unpack
```

### 0.2 Runtime 缓存架构

```typescript
// HomeMapRuntime — 地图在服务端/前端内存中的运行时表示
// 由 HomeMap 数据 + 缓存组成
interface HomeMapRuntime {
  // 持久化数据
  map: HomeMap
  things: Thing[]

  // —— 计算缓存（由 buildCache() 填充） ——
  tileGrid: TileFlag[][]           // 展开的 grid
  rooms: DetectedRoom[]            // flood-fill 结果
  roomGraph: RoomGraph             // 房间拓扑
  thingByDeviceId: Map<string, Thing>  // deviceId → Thing O(1)
  tileToRoomId: Map<string, string>    // "x,y" → roomId O(1)
  wallConnections: Map<string, WallConnections> // "x,y" → 4 方向墙连接

  // 版本号——增量更新用
  version: number
}

// buildCache — 从原始数据重建所有缓存（O(tiles)）
function buildCache(map: HomeMap, things: Thing[]): HomeMapRuntime {
  const grid = unpackGrid(map.packedGrid)
  const tileFlags = placeThingsOnGrid(grid, things)  // Thing → tile flag
  const rooms = detectRooms(tileFlags, things)
  const graph = buildRoomGraph(rooms)
  const deviceMap = new Map(things.filter(t => t.deviceId).map(t => [t.deviceId!, t]))
  const tileRoom = buildTileRoomMap(rooms)
  const walls = computeWallConnections(tileFlags)
  return { map, things, tileGrid, rooms, roomGraph: graph, thingByDeviceId: deviceMap, tileToRoomId: tileRoom, wallConnections: walls, version: 0 }
}

// 增量更新——只重新计算受影响的区域
function invalidateTile(runtime: HomeMapRuntime, x: number, y: number): void {
  // 清除该 tile 的缓存
  runtime.tileToRoomId.delete(`${x},${y}`)
  // 标记需要重建
  runtime.version++
}
```

### 0.3 Things 存储优化

```typescript
// DB 层：things 用 JSONB 存储 tags + config
// home_things 表：
//   id UUID PK
//   map_id UUID FK
//   thing_type VARCHAR(64) NOT NULL  -- 'wall', 'bed', 'ac'...
//   tile_x INTEGER, tile_y INTEGER
//   tile_w INTEGER DEFAULT 1, tile_h INTEGER DEFAULT 1
//   rotation INTEGER DEFAULT 0
//   device_id UUID NULLABLE
//   tags JSONB NOT NULL DEFAULT '{}'  -- 覆写默认 tags
//   config JSONB NOT NULL DEFAULT '{}' -- 运行时状态(exitDoor.homeStatus)

// 类型定义 —— 内置 Thing 的 tags 默认值 baked at compile time
// 不存 DB，直接写在 registry.ts 里
const BUILTIN_THING_TAGS: Record<string, TagCompound> = {
  wall:    { blocksMovement: true },
  door:    { isDoorConnector: true },
  exit_door: { isDoorConnector: true, exitDoor: { isExit: true, homeStatus: 'home' }, sensors: ['door_magnet'] },
  bed:     { sensors: ['heart_rate', 'respiratory_rate', 'bed_exit', 'motion'] },
  sofa:    { sensors: ['pressure', 'seated_hours'] },
  chair:   { sensors: ['pressure'] },
  ac:      { actuators: ['ac_mode', 'temperature_setpoint'], sensors: ['temperature', 'humidity', 'power'] },
  window:  { sensors: ['window_magnet', 'temperature'] },
  // ...
}

// 运行时：tags = { ...BUILTIN_THING_TAGS[type], ...instanceTags }
function resolveThingTags(thing: Thing): TagCompound {
  const defaults = BUILTIN_THING_TAGS[thing.thingType] ?? {}
  return { ...defaults, ...thing.tags }
}
```

### 0.4 Event Enrichment 索引

```typescript
// ingest 管道中，deviceId → Thing → room 的查询需要 O(1)
// 在 server 启动时和地图保存后重建
class RoomLookupCache {
  private thingByDevice = new Map<string, Thing>()
  private tileToRoom = new Map<string, string>()
  private version = 0

  rebuild(maps: HomeMapRuntime[]): void {
    this.thingByDevice.clear()
    this.tileToRoom.clear()
    for (const rt of maps) {
      for (const t of rt.things)
        if (t.deviceId) this.thingByDevice.set(t.deviceId, t)
      for (const [key, roomId] of rt.tileToRoomId)
        this.tileToRoom.set(key, roomId)
    }
    this.version++
  }

  enrich(event: { deviceId: string; tags: Record<string, unknown> }): void {
    const thing = this.thingByDevice.get(event.deviceId)
    if (!thing) return
    event.tags.thingId = thing.id
    event.tags.thingType = thing.thingType
    const roomId = this.tileToRoom.get(`${thing.tileX},${thing.tileY}`)
    if (roomId) event.tags.roomId = roomId
  }
}
```

---

## 1. 文件结构总览

### 1.1 shared-types 新增模块

```
packages/shared-types/src/home-map/
├── index.ts                        # 桶导出
├── types.ts                        # TileFlag, Thing, HomeMap, DetectedRoom, RoomGraph, TagCompound
├── grid.ts                         # packGrid, unpackGrid, createEmptyGrid, isWalkable
├── room-detection.ts               # detectRooms, buildRoomGraph, buildTileRoomMap, inferRoomType
├── pathfinding.ts                  # tileAStar (BinaryHeap, 4-dir)
├── wall-connections.ts             # computeWallConnections (4-方向邻居检测)
├── things/
│   ├── registry.ts                 # BUILTIN_THING_TAGS + resolveThingTags
│   └── placement.ts                # canPlaceThing (不得叠加、不得超出边界)
├── templates/
│   ├── studio.ts                   # 开间: 4x6
│   ├── one-bedroom.ts              # 一室一厅: 12x10
│   ├── two-bedroom.ts              # 两室一厅: 16x12
│   ├── three-bedroom.ts            # 三室一厅: 20x14
│   └── index.ts                    # 模板注册表
├── template-factory.ts             # createFromTemplate (模板→packedGrid+things+room detection)
├── runtime.ts                      # HomeMapRuntime, buildCache, invalidateTile
└── behavior/
    ├── room-stay.ts                # estimateCurrentRoom, aggregateRoomStays
    └── health-insights.ts          # crossReferenceEvents — 关联推断
```

### 1.2 server 变更

```
apps/server/src/
├── core/db/schema/
│   └── home-map.ts                 # home_maps 表 + home_things 表（新增）
├── core/trpc/routers/
│   └── home-map.ts                 # 地图/Thing CRUD + 模板生成 + 设备绑定
├── core/services/
│   └── room-lookup-cache.ts        # deviceId→thing→room O(1) cache
├── ingest/
│   └── enrich.ts                   # ingest 管道 enrichment 钩子
└── twin/
    ├── engine.ts                   # tick（复用现有, 精简）
    └── state.ts                    # exitDoor.homeStatus 运行时状态
```

### 1.3 web 新增/变更

```
apps/web/src/
├── pages/
│   └── HomeMapViewerPage.tsx       # 2D 地图展示页（只读）
├── twin/
│   ├── HomeMapCanvas.tsx           # Canvas 2D 主视口（渲染 tiles + walls + things）
│   ├── ThingRenderer.tsx           # Thing sprite 渲染
│   ├── RoomOverlay.tsx             # 房间颜色叠加层
│   └── Editor/
│       ├── MapEditorPage.tsx       # 编辑器页面
│       ├── PaintTool.tsx           # tile 刷（void/floor/wall/door）
│       ├── ThingPlacer.tsx         # Thing 放置（从 palette 选→拖到 grid）
│       ├── EditorPalette.tsx       # 左侧面板：Thing 列表 + 用户上传资产
│       └── Toolbar.tsx             # 上方面板：模板选择 / 保存 / 撤销
├── components/
│   └── RoomGraphView.tsx           # RoomGraph 纯拓扑展示（折线图）
└── hooks/
    └── useHomeMap.ts               # 加载地图 + buildCache + WebSocket 订阅
```

---

## 2. 里程碑（具体目标）

| 里程碑 | 内容 | 文件数 | 预估工时 |
|--------|------|--------|---------|
| M1 | shared-types 纯函数：pack/unpack、room detection、pathfinding | ~12 文件 | 2-3 天 |
| M2 | 模板系统 + factory：4 种户型 + createFromTemplate | ~6 文件 | 1 天 |
| M3 | DB schema + tRPC CRUD：maps/things 读写接口 + 模板生成 API | ~3 文件 | 1-2 天 |
| M4 | Runtime cache + ingest enrichment：deviceId→room 管道 | ~3 文件 | 1 天 |
| M5 | 前端 2D Canvas 视口 + Thing 渲染（只读） | ~4 文件 | 2-3 天 |
| M6 | 前端编辑器：paint tool + thing placer + palette | ~5 文件 | 3-4 天 |
| M7 | 行为分析：房间停留 + 健康关联推断 | ~3 文件 | 2 天 |
| M8 | 旧 map 模块迁移 + 清理 | ~5 文件 | 1 天 |

**可行性判断**：纯函数占 70%（可独立测试），API 占 10%，前端渲染占 20%。核心复杂度在 M1（算法正确性）和 M6（编辑器交互）。M1-M4 可并行进行。

---

## 3. Task 分解（M1 重点）

### M1-T1: 核心类型定义

**Files:**
- Create: `packages/shared-types/src/home-map/types.ts`
- Create: `packages/shared-types/src/home-map/index.ts`

**Content:** 上述 `TileFlag`、`TagCompound`、`Thing`、`HomeMap`、`DetectedRoom`、`RoomGraph` 类型定义。见上方 `types.ts` 代码。

### M1-T2: Grid 序列化

**Files:**
- Create: `packages/shared-types/src/home-map/grid.ts`
- Test: `packages/shared-types/src/home-map/__tests__/grid.test.ts`

**核心函数：**
```typescript
export function createEmptyGrid(w: number, h: number): TileFlag[][]  // 全 VOID
export function packGrid(flags: TileFlag[][]): PackedGrid            // 上文已定义
export function unpackGrid(packed: PackedGrid): TileFlag[][]         // 上文已定义
export function isWalkable(flags: TileFlag[][], x: number, y: number): boolean
// TileFlag.VOID → false, TileFlag.FLOOR → true, TileFlag.WALL → false, TileFlag.DOOR → true
export function placeTile(
  flags: TileFlag[][], x: number, y: number, flag: TileFlag
): TileFlag[][]  // 不可变更新
```

**测试内容：**
- `pack(unpack(grid)) === grid` 往返测试
- 100x100 grid pack 后 < 3000 bytes
- `isWalkable` 对 VOID/WALL 返回 false，对 FLOOR/DOOR 返回 true
- `placeTile` 不可变性

### M1-T3: 房间检测 + RoomGraph

**Files:**
- Create: `packages/shared-types/src/home-map/room-detection.ts`
- Test: `packages/shared-types/src/home-map/__tests__/room-detection.test.ts`

**核心函数：**
```typescript
export interface RoomDetectResult {
  rooms: DetectedRoom[]
  graph: RoomGraph
}

export function detectRooms(grid: TileFlag[][]): RoomDetectResult {
  // 1. 访问标记 visited[y][x] = false
  // 2. 遍历所有非 VOID tile
  // 3. flood-fill（4 方向），遇到 WALL 停止，遇到 DOOR 停止+记录
  // 4. 每轮 flood-fill = 一个房间
  // 5. 对每个 DOOR 边界，配对两侧房间
  // 6. 构建 RoomGraph
}

export function inferRoomType(
  room: DetectedRoom,
  grid: TileFlag[][],
  hasThingType: (type: string) => boolean
): RoomType {
  // 优先级：exitDoor → bedroom(bed) → bathroom(toilet) → kitchen(stove) → livingroom(maxArea) → hallway(aspect) → storage
}

export function buildRoomGraph(rooms: DetectedRoom[]): RoomGraph {
  // adjacency: Map<string, string[]>
  // edgeDoors: Map<string, string[]>
}

export function buildTileRoomMap(rooms: DetectedRoom[]): Map<string, string> {
  // "x,y" → roomId
}
```

**测试内容：**
- 3x3 全 FLOOR（无墙）→ 1 个房间
- 4x4 被 WALL 包围 → 1 个房间（内部 2x2 FLOOR）
- 两个房间中间一个 DOOR → 2 个房间，通过 door 连接
- 房间 + 出口门 → 该房间标记为 entry
- buildRoomGraph 正确输出 adjacency

### M1-T4: Tile 级 A* 寻路

**Files:**
- Create: `packages/shared-types/src/home-map/pathfinding.ts`
- Test: `packages/shared-types/src/home-map/__tests__/pathfinding.test.ts`

```typescript
export interface PathResult {
  path: { x: number; y: number }[]  // 包含起点和终点
  cost: number
}

export function tileAStar(
  grid: TileFlag[][],
  from: { x: number; y: number },
  to: { x: number; y: number },
  maxIterations: number = 10000
): PathResult | null

// 4 方向移动，BinaryHeap 优化
// 启发函数：Manhattan 距离
// 通过 WallConnections 只能穿过门 tile 不能穿墙
```

### M1-T5: 墙连接计算

**Files:**
- Create: `packages/shared-types/src/home-map/wall-connections.ts`
- Test: `packages/shared-types/src/home-map/__tests__/wall-connections.test.ts`

```typescript
export interface WallConnections {
  n: boolean; s: boolean; w: boolean; e: boolean
  // 4 方向邻居中，同是 WALL tile → true
  // 用于前端渲染 16 种连接纹理
}

export function computeWallConnections(
  grid: TileFlag[][]
): Map<string, WallConnections>  // key = "x,y"

// 测试：孤立 wall → { n:false, s:false, w:false, e:false }
// 水平 3 段墙 → 中间墙 { w:true, e:true, n:false, s:false }
```

### M1-T6: Thing Registry + 放置校验

**Files:**
- Create: `packages/shared-types/src/home-map/things/registry.ts`
- Create: `packages/shared-types/src/home-map/things/placement.ts`
- Test: `packages/shared-types/src/home-map/__tests__/placement.test.ts`

```typescript
// registry.ts
export const BUILTIN_THING_TAGS = { ... }  // 上文已定义

export interface ThingDef {
  type: string
  label: string
  tileW: number
  tileH: number
  category: 'structure' | 'device' | 'furnishing'
  defaultTags: TagCompound
}

export const BUILTIN_THINGS: ThingDef[] = [
  { type: 'wall', label: '墙', tileW: 1, tileH: 1, category: 'structure', defaultTags: { blocksMovement: true } },
  { type: 'door', label: '门', tileW: 1, tileH: 1, category: 'structure', defaultTags: { isDoorConnector: true } },
  { type: 'bed', label: '智能床', tileW: 2, tileH: 1, category: 'device', defaultTags: { sensors: ['heart_rate', 'bed_exit'] } },
  // ... 所有 15+ 内置类型
]

// placement.ts
export function canPlaceThing(
  grid: TileFlag[][],
  things: Thing[],
  type: string,
  x: number, y: number, w: number, h: number
): { ok: true } | { ok: false; reason: string }
// 规则：不能出界、不能与其他非墙 Thing 重叠
```

### M2-T1: 户型模板

**Files:**
- Create: `packages/shared-types/src/home-map/templates/studio.ts`
- Create: `packages/shared-types/src/home-map/templates/one-bedroom.ts`
- Create: `packages/shared-types/src/home-map/templates/two-bedroom.ts`
- Create: `packages/shared-types/src/home-map/templates/three-bedroom.ts`
- Create: `packages/shared-types/src/home-map/templates/index.ts`
- Create: `packages/shared-types/src/home-map/template-factory.ts`

两室一厅模板示例（16x12）：

```typescript
// templates/two-bedroom.ts
import { TileFlag } from '../types'

// 16x12 两室一厅
// 上排: 主卧(6x5) | 客厅(6x5) | 次卧(4x5)
// 下排: 卫浴(3x4) | 走廊(2x4)  | 厨房(4x4) | 阳台(5x4)
// 左: 玄关+出口门

export const TWO_BEDROOM_TILES: TileFlag[][] = /* 硬编码 16x12 grid */ [
  // 每行 16 个 tile 的瓦片值
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,0,1,1,1,1,1,1,0,0,0],
  // ... 完整 grid
]

export const TWO_BEDROOM_THINGS = [
  // walls（边界自动由瓦片标记）
  // doors
  { type: 'door', tileX: 5, tileY: 5 },      // 主卧→走廊
  { type: 'door', tileX: 9, tileY: 5 },      // 客厅→走廊
  { type: 'door', tileX: 13, tileY: 5 },     // 次卧→走廊
  { type: 'exit_door', tileX: 0, tileY: 5 }, // 玄关→外部
  // devices
  { type: 'bed', tileX: 1, tileY: 2 },       // 主卧床
  { type: 'sofa', tileX: 8, tileY: 2 },      // 客厅沙发
  { type: 'ac', tileX: 6, tileY: 1 },        // 客厅空调
  // ... 更多
]
```

```typescript
// template-factory.ts
export interface TemplateDef {
  id: string
  label: string
  width: number
  height: number
  tiles: TileFlag[][]        // 含 wall/floor/door 标记
  things: { type: string; tileX: number; tileY: number; tileW?: number; tileH?: number }[]
}

export const TEMPLATES: Record<string, TemplateDef> = {
  studio: STUDIO,
  one_bedroom: ONE_BEDROOM,
  two_bedroom: TWO_BEDROOM,
  three_bedroom: THREE_BEDROOM,
}

export function createFromTemplate(id: string): { map: HomeMap; runtime: HomeMapRuntime } {
  const tpl = TEMPLATES[id]
  const packed = packGrid(tpl.tiles)
  const things = tpl.things.map((t, i) => ({
    id: crypto.randomUUID(),
    ...t,
    tileW: t.tileW ?? 1,
    tileH: t.tileH ?? 1,
    rotation: 0 as const,
    tags: {},
    deviceId: null,
  }))
  const map: HomeMap = { id: '', patientId: '', templateId: id, packedGrid: packed, createdAt: '', updatedAt: '' }
  const runtime = buildCache(map, things)
  return { map, runtime }
}
```

### M3: DB Schema + tRPC

**Files:**
- Create: `apps/server/src/core/db/schema/home-map.ts`
- Create: `apps/server/src/core/trpc/routers/home-map.ts`

```typescript
// core/db/schema/home-map.ts
import { pgTable, uuid, varchar, integer, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core'

export const homeMaps = pgTable('home_maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').unique().notNull(),
  templateId: varchar('template_id', { length: 64 }),
  packedGrid: varchar('packed_grid', { length: 65535 }).notNull(),  // base64
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const homeThings = pgTable('home_things', {
  id: uuid('id').primaryKey().defaultRandom(),
  mapId: uuid('map_id').notNull().references(() => homeMaps.id, { onDelete: 'cascade' }),
  thingType: varchar('thing_type', { length: 64 }).notNull(),
  tileX: integer('tile_x').notNull(),
  tileY: integer('tile_y').notNull(),
  tileW: integer('tile_w').default(1),
  tileH: integer('tile_h').default(1),
  rotation: integer('rotation').default(0),
  deviceId: uuid('device_id').unique(),  // nullable, FK to devices.id
  tags: jsonb('tags').default('{}'),
  config: jsonb('config').default('{}'), // 运行时状态
})
```

### M4: Runtime Cache + Enrichment

**Files:**
- Create: `apps/server/src/core/services/room-lookup-cache.ts`
- Create: `apps/server/src/ingest/enrich.ts`

```typescript
// ingest/enrich.ts
// 在 ingest 管道的最后一步注入 spatial tags

import { RoomLookupCache } from '../core/services/room-lookup-cache'

export function createEnrichmentMiddleware(cache: RoomLookupCache) {
  return (event: { deviceId: string; tags: Record<string, unknown> }) => {
    cache.enrich(event)
    return event
  }
}

// 注册到现有 ingest pipeline 中：
// events.insert(event) → enrich(event) → db.insert(events).values(event)
```

### M5-M6: 前端渲染（概要）

前端核心是 Canvas 2D 渲染，不依赖 Three.js。关键组件：

```typescript
// HomeMapCanvas.tsx — 主视口
interface HomeMapCanvasProps {
  runtime: HomeMapRuntime
  cellSize?: number         // 默认 40px
  showRoomOverlay?: boolean
  interactive?: boolean      // 编辑器模式
  onTileClick?: (x: number, y: number) => void
}

// 渲染层级（从底到顶）：
// 1. Tile 底色（void=#2a2a2a, floor=#f0f0f0）
// 2. Wall 纹理（根据 wallConnections 选 sprite）
// 3. Door sprite（如 open/closed 状态）
// 4. Room overlay（半透明色块，按 roomType 着色）
// 5. Thing sprites（床、空调等）
// 6. 选中高亮（编辑器模式）
```

---

## 4. 可行性评估

| 模块 | 风险 | 缓解 |
|------|------|------|
| TileGrid pack/unpack | 低—纯数据变换 | 往返测试覆盖即可 |
| Room detection | 中—flood-fill 边界条件多 | 测试覆盖：单房间、相邻房间、L 形、T 形墙、孤立出口门 |
| A* 寻路 | 低—标准算法 | BinaryHeap 可以用 npm `heap` 包或用数组排序简化（grid < 100x100 不需 heap） |
| 模板制作 | 低—体力活 | 4 种模板 2h 内完成 |
| Canvas 渲染 | 中—性能优化（重绘时全帧刷新） | 使用 `useRef` 手动 Canvas，requestAnimationFrame 节流，脏区域局部重绘 |
| 编辑器交互 | 中高—拖拽/选中/paint 一致性 | 先用 click 模式（点击 tile 切换状态），拖拽后加 |
| 与旧系统兼容 | 中—旧 `map/` 模块数据需要迁移 | 保留旧 router，新增 `/trpc/home-map/*`，逐步替换 |

**不建议在第一期实现的内容：**
- 3D 渲染（已决策放弃）
- 多边形房间（只用矩形 bounds）
- 编辑器撤销/重做（第一期只做保存前确认）
- Canvas 缩放/平移（第一期固定视口，第二期补）

---

## 5. 实施顺序建议

```
Week 1: M1 (shared-types 纯函数) + M3 (DB schema)
         能独立测试，不依赖其他模块

Week 2: M2 (模板) + M4 (runtime cache + enrichment) + 旧 map router 兼容
         M2 依赖 M1, M4 依赖 M3

Week 3: M5 (前端只读视口) + M7 (行为分析)
         M5 依赖 M1, M7 依赖 M1

Week 4: M6 (前端编辑器) + M8 (清理)
         M6 是前端最重的工作，依赖 M5
```
