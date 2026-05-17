import { describe, it, expect } from 'vitest'
import { buildCache, invalidateTile, type HomeMapRuntime } from '../runtime'
import { createFromTemplate } from '../template-factory'
import { TileFlag } from '../types'

describe('buildCache', () => {
  it('unpacks grid and detects rooms from a template', () => {
    const { map, things } = createFromTemplate('studio')!
    const runtime = buildCache(map, things)
    expect(runtime.tileGrid).toBeDefined()
    expect(runtime.tileGrid.length).toBeGreaterThan(0)
    expect(runtime.rooms.length).toBeGreaterThan(0)
  })

  it('builds thingByDeviceId map from things with deviceId', () => {
    const { map, things } = createFromTemplate('studio')!
    things[0].deviceId = 'dev-001'
    const runtime = buildCache(map, things)
    expect(runtime.thingByDeviceId.get('dev-001')).toBe(things[0])
  })

  it('builds tileToRoomId map', () => {
    const { map, things } = createFromTemplate('studio')!
    const runtime = buildCache(map, things)
    expect(runtime.tileToRoomId.size).toBeGreaterThan(0)
  })

  it('computes wallConnections', () => {
    const { map, things } = createFromTemplate('studio')!
    const runtime = buildCache(map, things)
    expect(runtime.wallConnections.size).toBeGreaterThan(0)
  })

  it('stores references to map, things, roomGraph, version', () => {
    const { map, things } = createFromTemplate('studio')!
    const runtime = buildCache(map, things)
    expect(runtime.map).toBe(map)
    expect(runtime.things).toBe(things)
    expect(runtime.roomGraph).toBeDefined()
    expect(runtime.roomGraph.nodes).toBeDefined()
    expect(runtime.version).toBe(0)
  })
})

describe('invalidateTile', () => {
  it('removes tile from tileToRoomId and bumps version', () => {
    const { map, things } = createFromTemplate('studio')!
    const runtime = buildCache(map, things)
    const tileKey = runtime.rooms[0]?.tiles[0]
    if (!tileKey) return

    expect(runtime.tileToRoomId.has(tileKey)).toBe(true)
    const beforeVersion = runtime.version

    const [x, y] = tileKey.split(',').map(Number)
    invalidateTile(runtime, x, y)

    expect(runtime.tileToRoomId.has(tileKey)).toBe(false)
    expect(runtime.version).toBe(beforeVersion + 1)
  })
})
