interface NavRoomNode {
  roomId: string
  name: string
  centroid: { x: number; y: number }
  walkableTiles: { x: number; y: number }[]
}

interface NavEdge {
  fromRoomId: string
  toRoomId: string
  doorX: number
  doorY: number
}

export interface NavGraph {
  rooms: NavRoomNode[]
  edges: NavEdge[]
  passabilityGrid: number[][]  // 0=void, 1=floor, 2=door
}

interface RoomBounds {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
}

export function generateNavGraph(
  grid: number[][],
  rooms: RoomBounds[],
): NavGraph {
  const height = grid.length
  const width = grid[0]?.length ?? 0

  const roomNodes: NavRoomNode[] = []
  const doorPositions: { x: number; y: number }[] = []

  // Collect door positions from grid
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] === 2) {
        doorPositions.push({ x, y })
      }
    }
  }

  // Build room nodes
  for (const room of rooms) {
    const tiles: { x: number; y: number }[] = []
    for (let y = room.y; y < room.y + room.h && y < height; y++) {
      for (let x = room.x; x < room.x + room.w && x < width; x++) {
        if (grid[y][x] !== 0) {
          tiles.push({ x, y })
        }
      }
    }

    roomNodes.push({
      roomId: room.id,
      name: room.name,
      centroid: {
        x: Math.floor(room.x + room.w / 2),
        y: Math.floor(room.y + room.h / 2),
      },
      walkableTiles: tiles,
    })
  }

  // Build edges — doors connect adjacent rooms
  const edges: NavEdge[] = []
  for (const door of doorPositions) {
    const adjacentRooms = roomNodes.filter((r) =>
      r.walkableTiles.some((t) => Math.abs(t.x - door.x) <= 1 && Math.abs(t.y - door.y) <= 1),
    )
    if (adjacentRooms.length >= 2) {
      edges.push({
        fromRoomId: adjacentRooms[0].roomId,
        toRoomId: adjacentRooms[1].roomId,
        doorX: door.x,
        doorY: door.y,
      })
    }
  }

  return {
    rooms: roomNodes,
    edges,
    passabilityGrid: grid,
  }
}

export function findRoomForTile(navGraph: NavGraph, x: number, y: number): NavRoomNode | null {
  return navGraph.rooms.find((r) =>
    r.walkableTiles.some((t) => t.x === x && t.y === y),
  ) ?? null
}


