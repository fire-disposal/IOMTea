import { TileFlag, Thing, ThingDef } from '../types'

export function canPlaceThing(
  grid: TileFlag[][],
  existingThings: Thing[],
  def: ThingDef,
  x: number, y: number
): { ok: true } | { ok: false; reason: string } {
  const h = grid.length, w = h > 0 ? grid[0].length : 0
  if (x < 0 || y < 0 || x + def.tileW > w || y + def.tileH > h)
    return { ok: false, reason: '超出地图边界' }

  for (let ty = y; ty < y + def.tileH; ty++) {
    for (let tx = x; tx < x + def.tileW; tx++) {
      if (grid[ty][tx] === TileFlag.VOID)
        return { ok: false, reason: '不能放置在空中区域' }

      for (const existing of existingThings) {
        if (rectsOverlap(
          existing.tileX, existing.tileY, existing.tileW, existing.tileH,
          x, y, def.tileW, def.tileH
        )) {
          return { ok: false, reason: `与已有物体重叠 (${existing.thingType})` }
        }
      }
    }
  }

  return { ok: true }
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}
