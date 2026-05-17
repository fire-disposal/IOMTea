import { describe, it, expect } from 'vitest'
import { BUILTIN_THINGS, getThingDef, resolveThingTags } from '../things/registry'
import { canPlaceThing } from '../things/placement'
import { TileFlag, Thing } from '../types'

describe('registry', () => {
  it('has all expected built-in things', () => {
    const types = BUILTIN_THINGS.map(t => t.type)
    expect(types).toContain('wall')
    expect(types).toContain('bed')
    expect(types).toContain('sofa')
    expect(types).toContain('ac')
    expect(BUILTIN_THINGS.length).toBeGreaterThanOrEqual(15)
  })

  it('getThingDef returns correct def', () => {
    const def = getThingDef('bed')
    expect(def).toBeDefined()
    expect(def!.label).toBe('智能床')
    expect(def!.tileW).toBe(2)
    expect(def!.category).toBe('device')
  })

  it('getThingDef returns undefined for unknown type', () => {
    expect(getThingDef('unknown_type')).toBeUndefined()
  })

  it('resolveThingTags merges defaults with instance tags', () => {
    const thing: Thing = {
      id: 't1', thingType: 'bed', tileX: 0, tileY: 0, tileW: 2, tileH: 1,
      rotation: 0, deviceId: null,
      tags: { customTag: 'test' },
      config: {},
    }
    const tags = resolveThingTags(thing)
    expect(tags.sensors).toBeDefined()
    expect((tags.sensors as string[])).toContain('heart_rate')
    expect(tags.customTag).toBe('test')
  })

  it('resolveThingTags handles unknown type gracefully', () => {
    const thing: Thing = {
      id: 't1', thingType: 'nonexistent', tileX: 0, tileY: 0, tileW: 1, tileH: 1,
      rotation: 0, deviceId: null,
      tags: { foo: 'bar' },
      config: {},
    }
    const tags = resolveThingTags(thing)
    expect(tags.foo).toBe('bar')
  })
})

describe('placement', () => {
  const grid: TileFlag[][] = [
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
  ] as TileFlag[][]

  it('allows placement on floor tiles', () => {
    const def = getThingDef('chair')!
    const result = canPlaceThing(grid, [], def, 0, 0)
    expect(result.ok).toBe(true)
  })

  it('rejects placement partially on void', () => {
    const def = getThingDef('chair')!
    const result = canPlaceThing(grid, [], def, 0, 3)
    expect(result.ok).toBe(false)
  })

  it('rejects out of bounds', () => {
    const def = getThingDef('chair')!
    expect(canPlaceThing(grid, [], def, -1, 0).ok).toBe(false)
    expect(canPlaceThing(grid, [], def, 4, 4).ok).toBe(false)
  })

  it('rejects overlap with existing thing', () => {
    const existing: Thing[] = [{
      id: 'existing', thingType: 'bed', tileX: 1, tileY: 1, tileW: 2, tileH: 1,
      rotation: 0, deviceId: null, tags: {}, config: {},
    }]
    const def = getThingDef('chair')!
    const result = canPlaceThing(grid, existing, def, 1, 1)
    expect(result.ok).toBe(false)
  })

  it('allows non-overlapping placement near existing thing', () => {
    const existing: Thing[] = [{
      id: 'existing', thingType: 'bed', tileX: 1, tileY: 1, tileW: 2, tileH: 1,
      rotation: 0, deviceId: null, tags: {}, config: {},
    }]
    const def = getThingDef('chair')!
    const result = canPlaceThing(grid, existing, def, 3, 2)
    expect(result.ok).toBe(true)
  })
})
