import { describe, it, expect } from 'vitest'
import { findPath, type PathResult } from './pathfinding'

type GridCell = { terrain: 0 | 1 | 2 }

function g(grid: number[][]): GridCell[][] {
  return grid.map(row => row.map(c => ({ terrain: c as 0 | 1 | 2 })))
}

describe('findPath', () => {
  it('finds a straight path on empty floor', () => {
    const grid = g([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ])
    const result = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 })
    expect(result).not.toBeNull()
    expect(result!.path.length).toBeGreaterThanOrEqual(3)
    expect(result!.path[0]).toEqual({ x: 0, y: 0 })
    expect(result!.path[result!.path.length - 1]).toEqual({ x: 2, y: 2 })
  })

  it('routes through doors (terrain=2)', () => {
    const grid = g([
      [1, 1, 2],
      [1, 0, 1],
      [1, 1, 1],
    ])
    const result = findPath(grid, { x: 1, y: 0 }, { x: 2, y: 2 })
    expect(result).not.toBeNull()
  })

  it('avoids void tiles (terrain=0)', () => {
    const grid = g([
      [1, 1, 0],
      [1, 0, 0],
      [1, 1, 1],
    ])
    const result = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 })
    expect(result).not.toBeNull()
    for (const p of result!.path) {
      expect(grid[p.y][p.x].terrain).not.toBe(0)
    }
  })

  it('returns null when no path exists', () => {
    const grid = g([
      [1, 0, 1],
      [0, 0, 0],
      [1, 0, 1],
    ])
    const result = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 })
    expect(result).toBeNull()
  })

  it('handles same start and end', () => {
    const grid = g([[1]])
    const result = findPath(grid, { x: 0, y: 0 }, { x: 0, y: 0 })
    expect(result).not.toBeNull()
    expect(result!.path.length).toBe(1)
  })

  it('works on larger maps with multiple doors', () => {
    const grid = g([
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 2, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ])
    const result = findPath(grid, { x: 0, y: 0 }, { x: 4, y: 3 })
    expect(result).not.toBeNull()
  })
})


