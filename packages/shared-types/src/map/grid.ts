import type { MapModel, Tile, WallSegment, Entity } from './types'
import { getEntityDef } from './registries'

export function createEmptyTiles(width: number, height: number): Tile[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, (): Tile => ({ terrain: 'void' })),
  )
}

export function buildGrid(model: MapModel): void {
  const { width, height, zones } = model
  model.tiles = createEmptyTiles(width, height)

  for (const zone of zones) {
    const { x1, y1, x2, y2 } = zone.bounds
    for (let y = y1; y <= y2 && y < height; y++) {
      for (let x = x1; x <= x2 && x < width; x++) {
        model.tiles[y][x].terrain = 'floor'
      }
    }
  }
}

export function getWallSegments(model: MapModel): WallSegment[] {
  const segments: WallSegment[] = []
  const { tiles, tileSize } = model

  for (let y = 0; y < model.height; y++) {
    for (let x = 0; x < model.width; x++) {
      if (tiles[y][x].terrain !== 'floor') continue

      // Check right edge
      if (x + 1 >= model.width) {
        segments.push({
          x1: (x + 1) * tileSize, y1: y * tileSize,
          x2: (x + 1) * tileSize, y2: (y + 1) * tileSize,
          type: 'wall',
        })
      } else if (tiles[y][x + 1]?.terrain === 'void') {
        segments.push({
          x1: (x + 1) * tileSize, y1: y * tileSize,
          x2: (x + 1) * tileSize, y2: (y + 1) * tileSize,
          type: 'wall',
        })
      }

      // Check bottom edge
      if (y + 1 >= model.height) {
        segments.push({
          x1: x * tileSize, y1: (y + 1) * tileSize,
          x2: (x + 1) * tileSize, y2: (y + 1) * tileSize,
          type: 'wall',
        })
      } else if (tiles[y + 1]?.[x]?.terrain === 'void') {
        segments.push({
          x1: x * tileSize, y1: (y + 1) * tileSize,
          x2: (x + 1) * tileSize, y2: (y + 1) * tileSize,
          type: 'wall',
        })
      }
    }
  }

  // Remove segments covered by door/window entities
  for (const ent of model.entities) {
    const def = getEntityDef(ent.defId)
    if (!def || def.category !== 'structure') continue
    for (let i = segments.length - 1; i >= 0; i--) {
      const s = segments[i]
      const midX = (s.x1 + s.x2) / 2
      const midY = (s.y1 + s.y2) / 2
      const entCx = (ent.gridX + def.size.w / 2) * tileSize
      const entCy = (ent.gridY + def.size.h / 2) * tileSize
      if (Math.abs(midX - entCx) < tileSize * 0.6 && Math.abs(midY - entCy) < tileSize * 0.6) {
        segments.splice(i, 1)
      }
    }
  }

  return segments
}

export function entitiesAt(model: MapModel, x: number, y: number): Entity[] {
  return model.entities.filter((ent) => {
    const def = getEntityDef(ent.defId)
    if (!def) return false
    return x >= ent.gridX && x < ent.gridX + def.size.w && y >= ent.gridY && y < ent.gridY + def.size.h
  })
}

export function isWalkable(model: MapModel, x: number, y: number): boolean {
  const tile = model.tiles[y]?.[x]
  if (!tile || tile.terrain === 'void') return false

  for (const ent of entitiesAt(model, x, y)) {
    const def = getEntityDef(ent.defId)
    if (!def) continue
    if (def.walkability === 'solid') return false
    if (def.walkability === 'dynamic' && ent.meta?.open === false) return false
  }
  return true
}
