import { useMemo } from 'react'
import type { MapModel, EntityRuntime } from '@iomtea/shared-types/map'
import { getWallSegments, getEntityDef, getZoneDef } from '@iomtea/shared-types/map'

interface MapRenderer2DProps {
  model: MapModel
  cellSize?: number
  runtimes?: Map<string, EntityRuntime>
  showGrid?: boolean
}

export function MapRenderer2D({ model, cellSize = 32, runtimes, showGrid = false }: MapRenderer2DProps) {
  const walls = useMemo(() => getWallSegments(model), [model])
  const w = model.width * cellSize
  const h = model.height * cellSize

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {model.zones.map((zone) => {
        const def = getZoneDef(zone.defId)
        const zx = zone.bounds.x1 * cellSize
        const zy = zone.bounds.y1 * cellSize
        const zw = (zone.bounds.x2 - zone.bounds.x1 + 1) * cellSize
        const zh = (zone.bounds.y2 - zone.bounds.y1 + 1) * cellSize
        return (
          <g key={zone.id}>
            <rect
              x={zx} y={zy}
              width={zw} height={zh}
              fill={def?.color || '#eee'}
              stroke="#aaa" strokeWidth={1}
            />
            {zw >= 64 && zh >= 32 && (
              <text
                x={zx + zw / 2} y={zy + zh / 2}
                textAnchor="middle" dominantBaseline="central"
                fontSize={11} fill="#666" fontWeight={600}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {zone.name || def?.label || ''}
              </text>
            )}
          </g>
        )
      })}

      {showGrid &&
        Array.from({ length: model.width + 1 }, (_, i) => (
          <line key={`gv-${i}`} x1={i * cellSize} y1={0} x2={i * cellSize} y2={h} stroke="#ddd" strokeWidth={0.5} />
        ))
      }
      {showGrid &&
        Array.from({ length: model.height + 1 }, (_, i) => (
          <line key={`gh-${i}`} x1={0} y1={i * cellSize} x2={w} y2={i * cellSize} stroke="#ddd" strokeWidth={0.5} />
        ))
      }

      {walls.map((seg, i) => (
        <line
          key={`w-${i}`}
          x1={seg.x1 * cellSize} y1={seg.y1 * cellSize}
          x2={seg.x2 * cellSize} y2={seg.y2 * cellSize}
          stroke="#333" strokeWidth={2.5}
        />
      ))}

      {model.entities.map((ent) => {
        const def = getEntityDef(ent.defId)
        if (!def) return null
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
            {w2 >= cellSize && (
              <text x={x} y={y + 4} textAnchor="middle" fontSize={9} fill="#fff" style={{ pointerEvents: 'none' }}>
                {def.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
