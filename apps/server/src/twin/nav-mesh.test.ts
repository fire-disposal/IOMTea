import { describe, it, expect } from 'vitest'
import { generateNavGraph, findRoomForTile, type NavGraph } from './nav-mesh'

describe('generateNavGraph', () => {
  it('generates rooms and edges for a simple map', () => {
    const grid = [
      [1, 1, 2, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]
    const rooms = [
      { id: 'r1', name: 'Room 1', x: 0, y: 0, w: 3, h: 1 },
      { id: 'r2', name: 'Room 2', x: 3, y: 0, w: 2, h: 1 },
    ]
    const nav = generateNavGraph(grid, rooms)
    expect(nav.rooms).toHaveLength(2)
    expect(nav.rooms[0].roomId).toBe('r1')
    expect(nav.rooms[0].walkableTiles.length).toBeGreaterThan(0)
    expect(nav.passabilityGrid).toEqual(grid)
  })

  it('creates edges through door tiles', () => {
    const grid = [
      [1, 2, 1],
    ]
    const rooms = [
      { id: 'left', name: 'Left', x: 0, y: 0, w: 1, h: 1 },
      { id: 'right', name: 'Right', x: 2, y: 0, w: 1, h: 1 },
    ]
    const nav = generateNavGraph(grid, rooms)
    expect(nav.edges.length).toBeGreaterThanOrEqual(1)
  })
})

describe('findRoomForTile', () => {
  const nav: NavGraph = {
    rooms: [
      { roomId: 'r1', name: 'Room 1', centroid: { x: 1, y: 0 }, walkableTiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
      { roomId: 'r2', name: 'Room 2', centroid: { x: 4, y: 0 }, walkableTiles: [{ x: 3, y: 0 }, { x: 4, y: 0 }] },
    ],
    edges: [],
    passabilityGrid: [],
  }

  it('finds room containing tile', () => {
    expect(findRoomForTile(nav, 1, 0)?.roomId).toBe('r1')
  })

  it('returns null for tile not in any room', () => {
    expect(findRoomForTile(nav, 99, 99)).toBeNull()
  })
})


