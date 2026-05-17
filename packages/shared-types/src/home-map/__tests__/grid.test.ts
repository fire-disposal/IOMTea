import { describe, it, expect } from 'vitest'
import { createEmptyGrid, packGrid, unpackGrid, isWalkable, placeTile } from '../grid'
import { TileFlag } from '../types'

describe('createEmptyGrid', () => {
  it('creates grid of specified dimensions filled with VOID', () => {
    const grid = createEmptyGrid(3, 2)
    expect(grid.length).toBe(2)
    expect(grid[0].length).toBe(3)
    expect(grid[0][0]).toBe(TileFlag.VOID)
    expect(grid[1][2]).toBe(TileFlag.VOID)
  })
})

describe('packGrid / unpackGrid roundtrip', () => {
  it('roundtrips a simple grid', () => {
    const original = [
      [TileFlag.WALL, TileFlag.FLOOR],
      [TileFlag.DOOR, TileFlag.VOID],
    ]
    const packed = packGrid(original)
    expect(typeof packed).toBe('string')
    const unpacked = unpackGrid(packed)
    expect(unpacked).toEqual(original)
  })

  it('roundtrips a 100x100 grid (performance test)', () => {
    const grid = Array.from({ length: 100 }, () =>
      Array.from({ length: 100 }, () => Math.floor(Math.random() * 4) as TileFlag)
    )
    const packed = packGrid(grid)
    expect(packed.length).toBeLessThan(3500)
    const unpacked = unpackGrid(packed)
    expect(unpacked).toEqual(grid)
  })

  it('packs minimum grid (1x1)', () => {
    const grid = [[TileFlag.FLOOR]]
    const packed = packGrid(grid)
    const unpacked = unpackGrid(packed)
    expect(unpacked).toEqual(grid)
  })
})

describe('isWalkable', () => {
  const grid = [
    [TileFlag.VOID, TileFlag.FLOOR, TileFlag.WALL],
    [TileFlag.DOOR, TileFlag.FLOOR, TileFlag.VOID],
  ]

  it('returns false for void', () => expect(isWalkable(grid, 0, 0)).toBe(false))
  it('returns true for floor', () => expect(isWalkable(grid, 1, 0)).toBe(true))
  it('returns false for wall', () => expect(isWalkable(grid, 2, 0)).toBe(false))
  it('returns true for door', () => expect(isWalkable(grid, 0, 1)).toBe(true))
  it('returns false for out of bounds', () => {
    expect(isWalkable(grid, -1, 0)).toBe(false)
    expect(isWalkable(grid, 0, 5)).toBe(false)
  })
})

describe('placeTile', () => {
  it('returns new array with updated tile', () => {
    const grid = createEmptyGrid(3, 3)
    const result = placeTile(grid, 1, 1, TileFlag.FLOOR)
    expect(result[1][1]).toBe(TileFlag.FLOOR)
    expect(grid[1][1]).toBe(TileFlag.VOID)
  })

  it('does not mutate on out of bounds', () => {
    const grid = createEmptyGrid(2, 2)
    const result = placeTile(grid, 99, 99, TileFlag.FLOOR)
    expect(result).toBe(grid)
  })
})
