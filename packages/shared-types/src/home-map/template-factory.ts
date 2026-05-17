import { Thing, HomeMap } from './types'
import { packGrid } from './grid'
import { TEMPLATES } from './templates'

export function createFromTemplate(
  templateId: string,
  overrides?: { patientId?: string }
): { map: HomeMap; things: Thing[] } | null {
  const tpl = TEMPLATES[templateId]
  if (!tpl) return null

  const things: Thing[] = tpl.things.map((t, i) => ({
    id: `thing-${templateId}-${i}`,
    thingType: t.type,
    tileX: t.tileX,
    tileY: t.tileY,
    tileW: t.tileW ?? 1,
    tileH: t.tileH ?? 1,
    rotation: 0 as const,
    deviceId: null,
    tags: {},
    config: {},
  }))

  const map: HomeMap = {
    id: '',
    patientId: overrides?.patientId ?? '',
    templateId,
    packedGrid: packGrid(tpl.tiles),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return { map, things }
}
