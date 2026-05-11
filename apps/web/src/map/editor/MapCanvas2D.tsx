import { useState, useCallback, useEffect, useRef } from 'react'
import type { MapModel, Zone, Entity, EntityRuntime } from '@iomtea/shared-types/map'
import { getEntityDef, canPlaceEntity } from '@iomtea/shared-types/map'
import { MapRenderer2D } from '../MapRenderer2D'

type ToolMode = 'select' | 'draw-room' | { type: 'place-entity'; defId: string }

interface MapCanvas2DProps {
  model: MapModel
  mode: ToolMode
  zoneDefId: string
  selectedEntityId: string | null
  runtimes?: Map<string, EntityRuntime>
  onSelectEntity: (id: string | null) => void
  onAddEntity: (entity: Entity) => void
  onAddZone: (zone: Zone) => void
  onMoveEntity: (id: string, x: number, y: number) => void
  onDeleteEntity: (id: string) => void
  onDeleteZone: (zoneId: string) => void
  onRotateEntity: (id: string) => void
  onRenameZone: (zoneId: string, name: string) => void
}

export function MapCanvas2D(props: MapCanvas2DProps) {
  const { model, mode, zoneDefId, selectedEntityId, runtimes, onSelectEntity, onAddEntity, onAddZone, onMoveEntity, onDeleteEntity, onDeleteZone, onRotateEntity, onRenameZone } = props
  const cellSize = 32
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)
  const [dragEntityId, setDragEntityId] = useState<string | null>(null)
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const spaceDown = useRef(false)

  const screenToGrid = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    return {
      x: Math.floor((clientX - rect.left - offset.x) / (cellSize * scale)),
      y: Math.floor((clientY - rect.top - offset.y) / (cellSize * scale)),
    }
  }, [cellSize, scale, offset])

  const findZoneAt = useCallback((cell: { x: number; y: number }) => {
    return model.zones.find((z) => cell.x >= z.bounds.x1 && cell.x <= z.bounds.x2 && cell.y >= z.bounds.y1 && cell.y <= z.bounds.y2) || null
  }, [model.zones])

  // Keyboard: space=pan mode, R=rotate, Delete=delete
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); spaceDown.current = true }
      if ((e.key === 'r' || e.key === 'R') && selectedEntityId && !spaceDown.current) { e.preventDefault(); onRotateEntity(selectedEntityId) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEntityId) { e.preventDefault(); onDeleteEntity(selectedEntityId) }
    }
    const up = (e: KeyboardEvent) => { if (e.key === ' ') spaceDown.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [selectedEntityId, onRotateEntity, onDeleteEntity])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const zoom = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const newScale = Math.max(0.2, Math.min(4, scale * zoom))
    setOffset((prev) => ({
      x: mx - (mx - prev.x) * (newScale / scale),
      y: my - (my - prev.y) * (newScale / scale),
    }))
    setScale(newScale)
  }, [scale])

  // Middle mouse pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (e.button === 1 || (e.button === 0 && (e.ctrlKey || spaceDown.current))) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y })
      return
    }
    if (e.button === 2) {
      e.preventDefault()
      const cell = screenToGrid(e.clientX, e.clientY, rect)
      const zone = findZoneAt(cell)
      if (zone) onDeleteZone(zone.id)
      return
    }
    if (e.button !== 0) return

    const cell = screenToGrid(e.clientX, e.clientY, rect)
    if (e.detail === 2 && mode === 'select') {
      const zone = findZoneAt(cell)
      if (zone) { const name = prompt('房间名称:', zone.name || ''); if (name?.trim()) onRenameZone(zone.id, name.trim()) }
      return
    }
    if (mode === 'select') {
      const clicked = model.entities.find((ent) => {
        const def = getEntityDef(ent.defId)
        if (!def) return false
        return cell.x >= ent.gridX && cell.x < ent.gridX + def.size.w && cell.y >= ent.gridY && cell.y < ent.gridY + def.size.h
      })
      if (clicked) { onSelectEntity(clicked.id); setDragEntityId(clicked.id); setDragStart(cell) } else onSelectEntity(null)
    }
    if (mode === 'draw-room') { setDragStart(cell); setDragCurrent(cell) }
    if (typeof mode === 'object' && mode.type === 'place-entity') {
      const def = getEntityDef(mode.defId)
      if (!def) return
      if (canPlaceEntity(model, def, cell.x, cell.y).valid) {
        onAddEntity({ id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, defId: mode.defId, gridX: cell.x, gridY: cell.y, layer: def.layer, orientation: def.defaultOrientation, status: 'normal' })
      }
    }
  }, [mode, model, screenToGrid, findZoneAt, onSelectEntity, onAddEntity, onDeleteZone, onRenameZone, offset])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && panStart) {
      setOffset({ x: panStart.ox + (e.clientX - panStart.x), y: panStart.oy + (e.clientY - panStart.y) })
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const cell = screenToGrid(e.clientX, e.clientY, rect)
    setHoverCell(cell)
    if (dragStart && mode === 'draw-room') setDragCurrent(cell)
    if (dragEntityId && dragStart) {
      const dx = cell.x - dragStart.x; const dy = cell.y - dragStart.y
      if (dx !== 0 || dy !== 0) {
        const ent = model.entities.find((e) => e.id === dragEntityId)
        if (ent) {
          const def = getEntityDef(ent.defId)
          onMoveEntity(dragEntityId, Math.max(0, Math.min(model.width - (def?.size.w || 1), ent.gridX + dx)), Math.max(0, Math.min(model.height - (def?.size.h || 1), ent.gridY + dy)))
          setDragStart(cell)
        }
      }
    }
  }, [isPanning, panStart, dragStart, dragEntityId, mode, model, screenToGrid, onMoveEntity])

  const handleMouseUp = useCallback(() => {
    if (isPanning) { setIsPanning(false); setPanStart(null); return }
    if (dragStart && dragCurrent && mode === 'draw-room') {
      const x1 = Math.min(dragStart.x, dragCurrent.x); const y1 = Math.min(dragStart.y, dragCurrent.y)
      const x2 = Math.max(dragStart.x, dragCurrent.x); const y2 = Math.max(dragStart.y, dragCurrent.y)
      if (x2 - x1 >= 2 && y2 - y1 >= 2) {
        onAddZone({ id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, defId: zoneDefId, name: '新房间', bounds: { x1, y1, x2, y2 } })
      }
    }
    setDragStart(null); setDragCurrent(null); setDragEntityId(null)
  }, [isPanning, dragStart, dragCurrent, mode, zoneDefId, onAddZone])

  const showPreview = dragStart && dragCurrent && mode === 'draw-room'
  const w = model.width * cellSize; const h = model.height * cellSize

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', cursor: isPanning ? 'grabbing' : mode === 'draw-room' ? 'crosshair' : 'default' }}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel} onContextMenu={(e) => e.preventDefault()}>
      <div style={{ position: 'absolute', left: 4, top: 4, zIndex: 20, background: 'rgba(255,255,255,0.85)', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: '#666' }}>
        {Math.round(scale * 100)}% | 中键/空格拖动 · 滚轮缩放
      </div>
      <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0', width: w, height: h }}>
        <MapRenderer2D model={model} cellSize={cellSize} showGrid runtimes={runtimes} />

        {hoverCell && typeof mode === 'object' && mode.type === 'place-entity' && (() => {
          const def = getEntityDef(mode.defId)
          if (!def) return null
          const valid = canPlaceEntity(model, def, hoverCell.x, hoverCell.y).valid
          return (<div style={{ position: 'absolute', left: hoverCell.x * cellSize, top: hoverCell.y * cellSize, width: def.size.w * cellSize, height: def.size.h * cellSize, border: `2px solid ${valid ? '#4caf50' : '#f44336'}`, background: valid ? 'rgba(76,175,80,0.25)' : 'rgba(244,67,54,0.25)', pointerEvents: 'none', zIndex: 10 }}>
            <div style={{ position: 'absolute', bottom: -18, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: valid ? '#2e7d32' : '#c62828', whiteSpace: 'nowrap' }}>{def.label} {valid ? '✓' : '✗'}</div>
          </div>)
        })()}

        {showPreview && (<div style={{ position: 'absolute', left: Math.min(dragStart!.x, dragCurrent!.x) * cellSize, top: Math.min(dragStart!.y, dragCurrent!.y) * cellSize, width: (Math.abs(dragCurrent!.x - dragStart!.x) + 1) * cellSize, height: (Math.abs(dragCurrent!.y - dragStart!.y) + 1) * cellSize, border: '2px dashed #1976d2', background: 'rgba(25,118,210,0.12)', pointerEvents: 'none', zIndex: 10 }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1565c0', fontSize: 12, fontWeight: 600, opacity: 0.7 }}>{Math.abs(dragCurrent!.x - dragStart!.x) + 1}×{Math.abs(dragCurrent!.y - dragStart!.y) + 1}</div>
        </div>)}

        {selectedEntityId && (() => {
          const ent = model.entities.find((e) => e.id === selectedEntityId)
          if (!ent) return null
          const def = getEntityDef(ent.defId)
          if (!def) return null
          return (<div style={{ position: 'absolute', left: ent.gridX * cellSize, top: ent.gridY * cellSize, width: def.size.w * cellSize, height: def.size.h * cellSize, border: '2px solid #1976d2', pointerEvents: 'none', zIndex: 10, boxShadow: '0 0 0 1px rgba(25,118,210,0.3)' }} />)
        })()}
      </div>
    </div>
  )
}
