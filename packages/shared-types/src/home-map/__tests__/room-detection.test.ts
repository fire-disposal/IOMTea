import { describe, it, expect } from 'vitest'
import { detectRooms, inferRoomType, buildRoomGraph, buildTileRoomMap } from '../room-detection'
import { TileFlag } from '../types'

describe('detectRooms', () => {
  it('detects one room in a fully enclosed 3x3 area', () => {
    const grid = [
      [2,2,2,2,2],
      [2,1,1,1,2],
      [2,1,1,1,2],
      [2,1,1,1,2],
      [2,2,2,2,2],
    ] as TileFlag[][]
    const { rooms } = detectRooms(grid)
    expect(rooms.length).toBe(1)
    expect(rooms[0].area).toBe(9)
  })

  it('detects two rooms separated by a door', () => {
    const grid2: TileFlag[][] = Array.from({ length: 5 }, () => Array(9).fill(TileFlag.VOID))
    for (let y = 1; y <= 3; y++)
      for (let x = 1; x <= 3; x++)
        grid2[y][x] = TileFlag.FLOOR
    for (let y = 1; y <= 3; y++)
      for (let x = 5; x <= 7; x++)
        grid2[y][x] = TileFlag.FLOOR
    grid2[1][4] = TileFlag.WALL
    grid2[2][4] = TileFlag.DOOR
    grid2[3][4] = TileFlag.WALL
    for (let y = 0; y < 5; y++) { grid2[y][0] = TileFlag.WALL; grid2[y][8] = TileFlag.WALL }
    for (let x = 0; x < 9; x++) { grid2[0][x] = TileFlag.WALL; grid2[4][x] = TileFlag.WALL }

    const { rooms } = detectRooms(grid2)
    expect(rooms.length).toBe(2)
  })

  it('detects L-shaped room', () => {
    const grid: TileFlag[][] = Array.from({ length: 7 }, () => Array(5).fill(TileFlag.VOID))
    for (let y = 1; y <= 3; y++)
      for (let x = 1; x <= 3; x++)
        grid[y][x] = TileFlag.FLOOR
    for (let y = 4; y <= 5; y++)
      grid[y][1] = TileFlag.FLOOR
    for (let x = 0; x < 5; x++) { grid[0][x] = TileFlag.WALL; grid[6][x] = TileFlag.WALL }
    for (let y = 0; y < 7; y++) { grid[y][0] = TileFlag.WALL; grid[y][4] = TileFlag.WALL }
    grid[1][4] = TileFlag.WALL; grid[2][4] = TileFlag.WALL; grid[3][4] = TileFlag.WALL
    grid[4][2] = TileFlag.WALL; grid[4][3] = TileFlag.WALL; grid[5][2] = TileFlag.WALL; grid[5][3] = TileFlag.WALL

    const { rooms } = detectRooms(grid)
    expect(rooms.length).toBe(1)
    expect(rooms[0].area).toBe(11)
  })

  it('returns empty rooms for all-wall grid', () => {
    const grid = [
      [2,2,2],
      [2,2,2],
      [2,2,2],
    ] as TileFlag[][]
    const { rooms } = detectRooms(grid)
    expect(rooms.length).toBe(0)
  })

  it('includes door connections between adjacent rooms', () => {
    const grid: TileFlag[][] = Array.from({ length: 5 }, () => Array(9).fill(TileFlag.VOID))
    for (let y = 1; y <= 3; y++)
      for (let x = 1; x <= 3; x++)
        grid[y][x] = TileFlag.FLOOR
    for (let y = 1; y <= 3; y++)
      for (let x = 5; x <= 7; x++)
        grid[y][x] = TileFlag.FLOOR
    grid[1][4] = TileFlag.WALL; grid[3][4] = TileFlag.WALL
    grid[2][4] = TileFlag.DOOR
    for (let y = 0; y < 5; y++) { grid[y][0] = TileFlag.WALL; grid[y][8] = TileFlag.WALL }
    for (let x = 0; x < 9; x++) { grid[0][x] = TileFlag.WALL; grid[4][x] = TileFlag.WALL }

    const { rooms } = detectRooms(grid)
    expect(rooms.length).toBe(2)
    expect(rooms[0].doors.length).toBeGreaterThanOrEqual(1)
    expect(rooms[1].doors.length).toBeGreaterThanOrEqual(1)
    expect(rooms[0].doors[0].doorThingId).toBeTruthy()
    expect(rooms[1].doors[0].connectsToRoomId).toBe(rooms[0].id)
  })
})

describe('inferRoomType', () => {
  it('infers bedroom when room contains a bed', () => {
    const room = { id: 'r1', tiles: ['1,1'], area: 1, type: 'storage' as any, label: '', doors: [] }
    const things = [{ thingType: 'bed', tileX: 1, tileY: 1, id: 't1' }]
    const result = inferRoomType(room, [], things)
    expect(result).toBe('bedroom')
  })

  it('infers entry when room has exit_door at boundary', () => {
    const grid: TileFlag[][] = [
      [2,2,2,2],
      [2,1,3,2],
      [2,1,1,2],
      [2,2,2,2],
    ] as TileFlag[][]
    const things = [{ thingType: 'exit_door', tileX: 2, tileY: 1, id: 'exit1' }]
    const { rooms } = detectRooms(grid)
    expect(rooms.length).toBe(1)
    const type = inferRoomType(rooms[0], grid, things)
    expect(type).toBe('entry')
  })

  it('infers bathroom when room contains toilet', () => {
    const room = { id: 'r1', tiles: ['1,1'], area: 1, type: 'storage' as any, label: '', doors: [] }
    const things = [{ thingType: 'toilet', tileX: 1, tileY: 1, id: 't1' }]
    const result = inferRoomType(room, [], things)
    expect(result).toBe('bathroom')
  })

  it('infers bathroom when room contains shower', () => {
    const room = { id: 'r1', tiles: ['1,1'], area: 1, type: 'storage' as any, label: '', doors: [] }
    const things = [{ thingType: 'shower', tileX: 1, tileY: 1, id: 't1' }]
    const result = inferRoomType(room, [], things)
    expect(result).toBe('bathroom')
  })

  it('infers kitchen when room contains stove', () => {
    const room = { id: 'r1', tiles: ['1,1'], area: 1, type: 'storage' as any, label: '', doors: [] }
    const things = [{ thingType: 'stove', tileX: 1, tileY: 1, id: 't1' }]
    const result = inferRoomType(room, [], things)
    expect(result).toBe('kitchen')
  })

  it('infers kitchen when room contains fridge', () => {
    const room = { id: 'r1', tiles: ['1,1'], area: 1, type: 'storage' as any, label: '', doors: [] }
    const things = [{ thingType: 'fridge', tileX: 1, tileY: 1, id: 't1' }]
    const result = inferRoomType(room, [], things)
    expect(result).toBe('kitchen')
  })

  it('infers livingroom for the largest room', () => {
    const rooms = [
      { id: 'r1', tiles: ['0,0'], area: 20, type: 'storage' as any, label: '', doors: [] },
      { id: 'r2', tiles: ['1,0'], area: 10, type: 'storage' as any, label: '', doors: [] },
    ]
    const result = inferRoomType(rooms[0], [], [], rooms)
    expect(result).toBe('livingroom')
  })

  it('infers hallway for long narrow room', () => {
    const room = { id: 'r1', tiles: ['0,0','1,0','2,0','3,0'], area: 4, type: 'storage' as any, label: '', doors: [] }
    const grid: TileFlag[][] = Array.from({ length: 1 }, () => Array(4).fill(TileFlag.FLOOR))
    const result = inferRoomType(room, grid, [], [room])
    expect(result).toBe('hallway')
  })

  it('infers storage as default', () => {
    const room = { id: 'r1', tiles: ['0,0'], area: 1, type: 'storage' as any, label: '', doors: [] }
    const grid = [[TileFlag.FLOOR]]
    const result = inferRoomType(room, grid, [], [room])
    expect(result).toBe('storage')
  })
})

describe('buildRoomGraph', () => {
  it('builds adjacency from door connections', () => {
    const rooms = [
      { id: 'r1', tiles: ['1,1'], area: 1, type: 'bedroom' as any, label: '卧室', doors: [{ doorThingId: 'd1', connectsToRoomId: 'r2' }] },
      { id: 'r2', tiles: ['3,1'], area: 1, type: 'hallway' as any, label: '走廊', doors: [{ doorThingId: 'd1', connectsToRoomId: 'r1' }] },
    ]
    const graph = buildRoomGraph(rooms)
    expect(graph.nodes).toHaveLength(2)
    expect(graph.adjacency.get('r1')).toContain('r2')
    expect(graph.adjacency.get('r2')).toContain('r1')
  })

  it('maps edgeDoors correctly', () => {
    const rooms = [
      { id: 'r1', tiles: ['1,1'], area: 1, type: 'bedroom' as any, label: '', doors: [{ doorThingId: 'd1', connectsToRoomId: 'r2' }] },
      { id: 'r2', tiles: ['3,1'], area: 1, type: 'hallway' as any, label: '', doors: [{ doorThingId: 'd1', connectsToRoomId: 'r1' }] },
    ]
    const graph = buildRoomGraph(rooms)
    const key = 'r1-r2'
    expect(graph.edgeDoors.get(key)).toContain('d1')
  })
})

describe('buildTileRoomMap', () => {
  it('maps tile coordinates to room ID', () => {
    const rooms = [
      { id: 'r1', tiles: ['0,0', '1,0', '0,1', '1,1'], area: 4, type: 'bedroom' as any, label: '', doors: [] },
    ]
    const map = buildTileRoomMap(rooms)
    expect(map.get('0,0')).toBe('r1')
    expect(map.get('1,1')).toBe('r1')
    expect(map.has('2,2')).toBe(false)
  })

  it('handles empty rooms array', () => {
    const map = buildTileRoomMap([])
    expect(map.size).toBe(0)
  })
})

describe('integration - detectRooms with things', () => {
  it('detects rooms and infers types with things', () => {
    const grid: TileFlag[][] = Array.from({ length: 5 }, () => Array(9).fill(TileFlag.VOID))
    for (let y = 1; y <= 3; y++)
      for (let x = 1; x <= 3; x++)
        grid[y][x] = TileFlag.FLOOR
    for (let y = 1; y <= 3; y++)
      for (let x = 5; x <= 7; x++)
        grid[y][x] = TileFlag.FLOOR
    grid[1][4] = TileFlag.WALL; grid[3][4] = TileFlag.WALL
    grid[2][4] = TileFlag.DOOR
    for (let y = 0; y < 5; y++) { grid[y][0] = TileFlag.WALL; grid[y][8] = TileFlag.WALL }
    for (let x = 0; x < 9; x++) { grid[0][x] = TileFlag.WALL; grid[4][x] = TileFlag.WALL }

    const things = [
      { id: 'bed1', thingType: 'bed', tileX: 2, tileY: 2 },
      { id: 'exit1', thingType: 'exit_door', tileX: 4, tileY: 2 },
    ]

    const result = detectRooms(grid, things)
    expect(result.rooms.length).toBe(2)
    expect(result.graph.nodes.length).toBe(2)
    expect(result.graph.adjacency.size).toBeGreaterThan(0)
  })
})
