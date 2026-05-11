import { useMemo } from 'react'
import type { MapModel, EntityRuntime } from '@iomtea/shared-types/map'
import { getWallSegments, getEntityDef, getZoneDef } from '@iomtea/shared-types/map'

interface MapRenderer2DProps {
  model: MapModel
  cellSize?: number
  runtimes?: Map<string, EntityRuntime>
}

export function MapRenderer2D({ model, cellSize = 32, runtimes }: MapRenderer2DProps) {
  const walls = useMemo(() => getWallSegments(model), [model])
  const w = model.width * cellSize
  const h = model.height * cellSize

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {model.zones.map((zone) => {
        const def = getZoneDef(zone.defId)
        return (
          <rect
            key={zone.id}
            x={zone.bounds.x1 * cellSize}
            y={zone.bounds.y1 * cellSize}
            width={(zone.bounds.x2 - zone.bounds.x1 + 1) * cellSize}
            height={(zone.bounds.y2 - zone.bounds.y1 + 1) * cellSize}
            fill={def?.color || '#eee'}
            stroke="#ccc"
            strokeWidth={1}
          />
        )
      })}

      {walls.map((seg, i) => (
        <line
          key={`w-${i}`}
          x1={seg.x1 * cellSize}
          y1={seg.y1 * cellSize}
          x2={seg.x2 * cellSize}
          y2={seg.y2 * cellSize}
          stroke="#333"
          strokeWidth={2}
        />
      ))}

      {model.entities.map((ent) => {
        const def = getEntityDef(ent.defId)
        if (!def) return null
        const runtime = runtimes?.get(ent.id)
        const x = (ent.gridX + def.pivot.x) * cellSize
        const y = (ent.gridY + def.pivot.y) * cellSize
        const color = def.render2D?.color || '#999'

        if (def.render2D?.icon === 'circle') {
          return <circle key={ent.id} cx={x} cy={y} r={cellSize * 0.3} fill={color} />
        }
        if (def.render2D?.icon === 'line') {
          return <rect key={ent.id} x={x - cellSize * 0.1} y={y - cellSize * 0.4} width={cellSize * 0.2} height={cellSize * 0.8} fill={color} />
        }
        const w2 = def.size.w * cellSize
        const h2 = def.size.h * cellSize
        return (
          <g key={ent.id}>
            <rect x={ent.gridX * cellSize} y={ent.gridY * cellSize} width={w2} height={h2} fill={color} rx={2} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={9} fill="#fff">
              {def.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
