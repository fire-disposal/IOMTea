import { TileFlag, type DetectedRoom, type RoomType, type RoomGraph, type RoomDetectResult } from './types'

const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]]

function parseTileKey(key: string): [number, number] {
  const [x, y] = key.split(',')
  return [Number(x), Number(y)]
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`
}

interface RoomData {
  id: string
  tiles: string[]
  boundaryDoors: { doorX: number; doorY: number }[]
}

export function detectRooms(
  grid: TileFlag[][],
  things?: { id: string; thingType: string; tileX: number; tileY: number }[],
): RoomDetectResult {
  const h = grid.length
  const w = h > 0 ? grid[0].length : 0
  const visited: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false))
  const roomDatas: RoomData[] = []

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (visited[y][x]) continue
      const tile = grid[y][x]
      if (tile === TileFlag.WALL || tile === TileFlag.VOID || tile === TileFlag.DOOR) continue

      const roomTiles: string[] = []
      const boundaryDoorSet = new Set<string>()
      const boundaryDoors: { doorX: number; doorY: number }[] = []
      const queue: [number, number][] = [[x, y]]
      visited[y][x] = true

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!
        roomTiles.push(tileKey(cx, cy))

        for (const [dx, dy] of DIRS) {
          const nx = cx + dx
          const ny = cy + dy
          if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue
          const neighborTile = grid[ny][nx]
          if (visited[ny][nx]) continue

          if (neighborTile === TileFlag.FLOOR) {
            visited[ny][nx] = true
            queue.push([nx, ny])
          } else if (neighborTile === TileFlag.DOOR) {
            const dk = tileKey(nx, ny)
            if (!boundaryDoorSet.has(dk)) {
              boundaryDoorSet.add(dk)
              boundaryDoors.push({ doorX: nx, doorY: ny })
            }
          }
        }
      }

      roomDatas.push({
        id: `room-${roomDatas.length}`,
        tiles: roomTiles,
        boundaryDoors,
      })
    }
  }

  const tileToRoom = new Map<string, string>()
  for (const rd of roomDatas) {
    for (const t of rd.tiles) {
      tileToRoom.set(t, rd.id)
    }
  }

  const rooms: DetectedRoom[] = roomDatas.map(rd => {
    const roomDoors: { doorThingId: string; connectsToRoomId: string }[] = []
    for (const bd of rd.boundaryDoors) {
      for (const [ddx, ddy] of DIRS) {
        const sx = bd.doorX + ddx
        const sy = bd.doorY + ddy
        if (sy < 0 || sy >= h || sx < 0 || sx >= w) continue
        const neighborRoomId = tileToRoom.get(tileKey(sx, sy))
        if (neighborRoomId && neighborRoomId !== rd.id) {
          const thingId = `door@${bd.doorX},${bd.doorY}`
          if (!roomDoors.some(d => d.connectsToRoomId === neighborRoomId)) {
            roomDoors.push({ doorThingId: thingId, connectsToRoomId: neighborRoomId })
          }
          break
        }
      }
    }
    return {
      id: rd.id,
      tiles: rd.tiles,
      area: rd.tiles.length,
      type: 'storage' as RoomType,
      label: '',
      doors: roomDoors,
    }
  })

  const graph = buildRoomGraph(rooms)

  return { rooms, graph }
}

export function inferRoomType(
  room: DetectedRoom,
  grid: TileFlag[][],
  things?: { thingType: string; tileX: number; tileY: number }[],
  allRooms?: DetectedRoom[],
): RoomType {
  if (things && things.length > 0) {
    const roomTileSet = new Set(room.tiles)

    for (const thing of things) {
      if (thing.thingType === 'exit_door') {
        const tk = tileKey(thing.tileX, thing.tileY)
        if (roomTileSet.has(tk)) return 'entry'
        for (const rt of room.tiles) {
          const [rx, ry] = parseTileKey(rt)
          for (const [dx, dy] of DIRS) {
            if (rx + dx === thing.tileX && ry + dy === thing.tileY) {
              if (grid[thing.tileY]?.[thing.tileX] === TileFlag.DOOR) {
                return 'entry'
              }
            }
          }
        }
      }
    }

    const thingsInRoom = things.filter(t => roomTileSet.has(tileKey(t.tileX, t.tileY)))

    for (const thing of thingsInRoom) {
      if (thing.thingType === 'bed') return 'bedroom'
    }

    for (const thing of thingsInRoom) {
      if (thing.thingType === 'toilet' || thing.thingType === 'shower') return 'bathroom'
    }

    for (const thing of thingsInRoom) {
      if (thing.thingType === 'stove' || thing.thingType === 'fridge') return 'kitchen'
    }
  }

  if (room.tiles.length > 1) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const t of room.tiles) {
      const [xx, yy] = parseTileKey(t)
      if (xx < minX) minX = xx
      if (xx > maxX) maxX = xx
      if (yy < minY) minY = yy
      if (yy > maxY) maxY = yy
    }
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const ratio = Math.max(w, h) / Math.min(w, h)
    if (ratio > 3) return 'hallway'
  }

  if (allRooms && allRooms.length > 1) {
    const maxArea = Math.max(...allRooms.map(r => r.area))
    if (room.area === maxArea) return 'livingroom'
  }

  return 'storage'
}

export function buildRoomGraph(rooms: DetectedRoom[]): RoomGraph {
  const nodes = rooms
  const adjacency = new Map<string, string[]>()
  const edgeDoors = new Map<string, string[]>()

  for (const room of rooms) {
    adjacency.set(room.id, [])
  }

  for (const room of rooms) {
    for (const door of room.doors) {
      const adj = adjacency.get(room.id)!
      if (!adj.includes(door.connectsToRoomId)) {
        adj.push(door.connectsToRoomId)
      }

      const key = [room.id, door.connectsToRoomId].sort().join('-')
      if (!edgeDoors.has(key)) {
        edgeDoors.set(key, [])
      }
      const edges = edgeDoors.get(key)!
      if (!edges.includes(door.doorThingId)) {
        edges.push(door.doorThingId)
      }
    }
  }

  return { nodes, adjacency, edgeDoors }
}

export function buildTileRoomMap(rooms: DetectedRoom[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const room of rooms) {
    for (const tile of room.tiles) {
      map.set(tile, room.id)
    }
  }
  return map
}
