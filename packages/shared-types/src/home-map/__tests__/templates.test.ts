import { describe, it, expect } from 'vitest'
import { TEMPLATES } from '../templates'
import { createFromTemplate } from '../template-factory'
import { unpackGrid } from '../grid'
import { TileFlag } from '../types'

describe('template registry', () => {
  it('has all 4 templates', () => {
    expect(Object.keys(TEMPLATES)).toEqual(['studio', 'one_bedroom', 'two_bedroom', 'three_bedroom'])
  })

  it('each template has correct dimensions', () => {
    expect(TEMPLATES.studio.width).toBe(6)
    expect(TEMPLATES.studio.height).toBe(6)
    expect(TEMPLATES.one_bedroom.width).toBe(12)
    expect(TEMPLATES.one_bedroom.height).toBe(10)
    expect(TEMPLATES.two_bedroom.width).toBe(16)
    expect(TEMPLATES.two_bedroom.height).toBe(12)
    expect(TEMPLATES.three_bedroom.width).toBe(20)
    expect(TEMPLATES.three_bedroom.height).toBe(14)
  })

  it('each template has walls on all outer edges', () => {
    for (const tpl of Object.values(TEMPLATES)) {
      const { tiles } = tpl
      for (let x = 0; x < tpl.width; x++) {
        expect(tiles[0][x]).toBe(TileFlag.WALL)
        expect(tiles[tpl.height - 1][x]).toBe(TileFlag.WALL)
      }
      for (let y = 0; y < tpl.height; y++) {
        expect(tiles[y][0]).toBe(TileFlag.WALL)
        expect(tiles[y][tpl.width - 1]).toBe(TileFlag.WALL)
      }
    }
  })
})

describe('createFromTemplate', () => {
  it('creates map and things from template', () => {
    const result = createFromTemplate('studio')
    expect(result).not.toBeNull()
    expect(result!.map.templateId).toBe('studio')
    expect(result!.things.length).toBeGreaterThan(0)
  })

  it('returns null for unknown template', () => {
    expect(createFromTemplate('nonexistent')).toBeNull()
  })

  it('packed grid round-trips correctly from template', () => {
    const tpl = TEMPLATES.studio
    const result = createFromTemplate('studio')!
    const unpacked = unpackGrid(result.map.packedGrid)
    expect(unpacked).toEqual(tpl.tiles)
  })

  it('things are placed on walkable tiles', () => {
    const result = createFromTemplate('studio')!
    const grid = unpackGrid(result.map.packedGrid)
    for (const thing of result.things) {
      for (let dy = 0; dy < thing.tileH; dy++) {
        for (let dx = 0; dx < thing.tileW; dx++) {
          const x = thing.tileX + dx
          const y = thing.tileY + dy
          if (thing.thingType === 'door' || thing.thingType === 'exit_door') {
            expect(grid[y][x]).toBe(TileFlag.DOOR)
          } else {
            expect(grid[y][x]).toBe(TileFlag.FLOOR)
          }
        }
      }
    }
  })

  it('all templates can be created without errors', () => {
    for (const id of Object.keys(TEMPLATES)) {
      const result = createFromTemplate(id)
      expect(result).not.toBeNull()
      expect(result!.map.templateId).toBe(id)
    }
  })
})
