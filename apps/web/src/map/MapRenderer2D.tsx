import { useMemo } from 'react'
import type { MapModel, EntityRuntime } from '@iomtea/shared-types/map'
import { getWallSegments, getEntityDef, getZoneDef, getAsset } from '@iomtea/shared-types/map'

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
            <rect x={zx} y={zy} width={zw} height={zh} fill={def?.color || '#eee'} stroke="#aaa" strokeWidth={1} />
            {zw >= 64 && zh >= 32 && (
              <text x={zx + zw / 2} y={zy + zh / 2} textAnchor="middle" dominantBaseline="central"
                fontSize={11} fill="#999" fontWeight={600}
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {zone.name || def?.label || ''}
              </text>
            )}
          </g>
        )
      })}

      {showGrid && Array.from({ length: model.width + 1 }, (_, i) => (
        <line key={`gv-${i}`} x1={i * cellSize} y1={0} x2={i * cellSize} y2={h} stroke="#ddd" strokeWidth={0.5} />
      ))}
      {showGrid && Array.from({ length: model.height + 1 }, (_, i) => (
        <line key={`gh-${i}`} x1={0} y1={i * cellSize} x2={w} y2={i * cellSize} stroke="#ddd" strokeWidth={0.5} />
      ))}

      {walls.map((seg, i) => (
        <line key={`w-${i}`} x1={seg.x1 * cellSize} y1={seg.y1 * cellSize}
          x2={seg.x2 * cellSize} y2={seg.y2 * cellSize} stroke="#333" strokeWidth={2.5} />
      ))}

      {model.entities.map((ent) => {
        const def = getEntityDef(ent.defId)
        if (!def) return null
        const asset = getAsset(def.assetId)
        const sprite = asset?.sprite2D || { shape: 'rect' as const, color: '#999', size: [0.8, 0.8] as [number, number] }

        const runtime = runtimes?.get(ent.id)
        const tx = runtime?.state === 'moving' && runtime.path && runtime.pathProgress !== undefined
          ? ent.gridX + (runtime.path[runtime.path.length - 1]?.x ?? ent.gridX - ent.gridX) * (runtime.pathProgress ?? 0)
          : ent.gridX
        const ty = runtime?.state === 'moving' && runtime.path && runtime.pathProgress !== undefined
          ? ent.gridY + (runtime.path[runtime.path.length - 1]?.y ?? ent.gridY - ent.gridY) * (runtime.pathProgress ?? 0)
          : ent.gridY

        const cx = (tx + def.pivot.x) * cellSize
        const cy = (ty + def.pivot.y) * cellSize
        const sw = sprite.size[0] * cellSize
        const sh = sprite.size[1] * cellSize

        switch (sprite.shape) {
          case 'circle':
            return <circle key={ent.id} cx={cx} cy={cy} r={sw / 2} fill={sprite.color} />
          case 'diamond':
            return (
              <polygon key={ent.id}
                points={`${cx},${cy - sh / 2} ${cx + sw / 2},${cy} ${cx},${cy + sh / 2} ${cx - sw / 2},${cy}`}
                fill={sprite.color} />
            )
          case 'line': {
            const hw = sprite.size[0] * cellSize
            const hh = sprite.size[1] * cellSize
            return <rect key={ent.id} x={cx - hw / 2} y={cy - hh / 2} width={hw} height={hh} fill={sprite.color} rx={1} />
          }
          case 'icon':
            return sprite.svgPath
              ? <path key={ent.id} d={sprite.svgPath} fill={sprite.color} transform={`translate(${cx},${cy})`} />
              : <rect key={ent.id} x={ent.gridX * cellSize + 2} y={ent.gridY * cellSize + 2}
                  width={cellSize - 4} height={cellSize - 4} fill={sprite.color} rx={2} />
          default: {
            const rx = ent.gridX * cellSize + (cellSize - sw) / 2
            const ry = ent.gridY * cellSize + (cellSize - sh) / 2
            return (
              <g key={ent.id}>
                <rect x={rx} y={ry} width={sw} height={sh} fill={sprite.color} rx={2} />
                {sprite.label && sw >= 20 && sh >= 12 && (
                  <text x={rx + sw / 2} y={ry + sh / 2 + 1} textAnchor="middle" dominantBaseline="central"
                    fontSize={Math.min(10, sh * 0.7)} fill={sprite.labelColor || '#fff'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {sprite.label}
                  </text>
                )}
              </g>
            )
          }
        }
      })}
    </svg>
  )
}
