import { TileFlag, Thing, HomeMap, DetectedRoom, RoomGraph } from './types'
import { unpackGrid } from './grid'
import { detectRooms, buildRoomGraph, buildTileRoomMap } from './room-detection'
export interface WallConnections {
  n: boolean
  s: boolean
  w: boolean
  e: boolean
}

function computeWallConnections(grid: TileFlag[][]): Map<string, WallConnections> {
  const result = new Map<string, WallConnections>()
  const h = grid.length
  const w = h > 0 ? grid[0].length : 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] !== TileFlag.WALL) continue

      const n = y > 0 && (grid[y - 1][x] & TileFlag.WALL) === TileFlag.WALL
      const s = y < h - 1 && (grid[y + 1][x] & TileFlag.WALL) === TileFlag.WALL
      const ww = x > 0 && (grid[y][x - 1] & TileFlag.WALL) === TileFlag.WALL
      const e = x < w - 1 && (grid[y][x + 1] & TileFlag.WALL) === TileFlag.WALL

      result.set(`${x},${y}`, { n, s, w: ww, e })
    }
  }

  return result
}

export interface HomeMapRuntime {
  map: HomeMap
  things: Thing[]
  tileGrid: TileFlag[][]
  rooms: DetectedRoom[]
  roomGraph: RoomGraph
  thingByDeviceId: Map<string, Thing>
  tileToRoomId: Map<string, string>
  wallConnections: Map<string, WallConnections>
  version: number
}

export function buildCache(map: HomeMap, things: Thing[]): HomeMapRuntime {
  const tileGrid = unpackGrid(map.packedGrid)

  const { rooms, graph } = detectRooms(tileGrid)

  const thingByDeviceId = new Map<string, Thing>()
  for (const t of things) {
    if (t.deviceId) thingByDeviceId.set(t.deviceId, t)
  }

  const tileToRoomId = buildTileRoomMap(rooms)

  const wallConnections = computeWallConnections(tileGrid)

  return {
    map, things, tileGrid, rooms, roomGraph: graph,
    thingByDeviceId, tileToRoomId, wallConnections,
    version: 0,
  }
}

export function invalidateTile(runtime: HomeMapRuntime, x: number, y: number): void {
  runtime.tileToRoomId.delete(`${x},${y}`)
  runtime.version++
}
