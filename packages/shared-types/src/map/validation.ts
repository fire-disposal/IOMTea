import type { MapModel, EntityDef, Entity } from './types'
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
