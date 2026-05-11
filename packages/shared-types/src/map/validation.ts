import type { MapModel, EntityDef, Entity, Zone } from './types'
import { getEntityDef } from './registries'
import { entitiesAt } from './grid'

export interface ValidationResult {
  valid: boolean
  reason?: string
}

export function canPlaceEntity(
  model: MapModel,
  def: EntityDef,
  x: number,
  y: number,
  excludeEntityId?: string,
): ValidationResult {
  for (let dy = 0; dy < def.size.h; dy++) {
    for (let dx = 0; dx < def.size.w; dx++) {
      const tx = x + dx
      const ty = y + dy

      if (tx < 0 || tx >= model.width || ty < 0 || ty >= model.height) {
        return { valid: false, reason: '超出地图边界' }
      }

      const tile = model.tiles[ty]?.[tx]
      if (!tile || tile.terrain !== 'floor') {
        return { valid: false, reason: '只能放在地板格上' }
      }

      const existing = entitiesAt(model, tx, ty).filter((e) => e.id !== excludeEntityId)
      for (const ent of existing) {
        const entDef = getEntityDef(ent.defId)
        if (!entDef) continue
        if (entDef.layer === def.layer && entDef.walkability === 'solid' && def.walkability === 'solid') {
          return { valid: false, reason: `与 ${entDef.label} 重叠` }
        }
      }
    }
  }
  return { valid: true }
}

function overlap(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1
}

function area(b: { x1: number; y1: number; x2: number; y2: number }): number {
  return (b.x2 - b.x1 + 1) * (b.y2 - b.y1 + 1)
}

export function mergeZones(existing: Zone[], newZone: Zone): Zone[] {
  const result: Zone[] = []

  for (const zone of existing) {
    if (!overlap(zone.bounds, newZone.bounds)) {
      result.push(zone)
      continue
    }

    const { x1, y1, x2, y2 } = zone.bounds
    const { x1: nx1, y1: ny1, x2: nx2, y2: ny2 } = newZone.bounds

    if (nx1 <= x1 && nx2 >= x2 && ny1 <= y1 && ny2 >= y2) {
      continue
    }

    const candidates = [
      nx1 > x1 ? { x1, y1, x2: nx1 - 1, y2 } : null,
      nx2 < x2 ? { x1: nx2 + 1, y1, x2, y2 } : null,
      ny1 > y1 ? { x1, y1, x2, y2: ny1 - 1 } : null,
      ny2 < y2 ? { x1: ny1 + 1, y1, x2, y2 } : null,
    ].filter((c): c is NonNullable<typeof c> => c !== null)

    const best = candidates.sort((a, b) => area(b) - area(a))[0]

    if (best && area(best) >= 4) {
      result.push({ ...zone, bounds: best })
    }
  }

  result.push(newZone)
  return result
}
