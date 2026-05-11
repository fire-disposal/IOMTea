import { useState, useCallback, useEffect } from 'react'
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

export function MapCanvas2D({
  model, mode, zoneDefId, selectedEntityId, runtimes, onSelectEntity, onAddEntity, onAddZone,
  onMoveEntity, onDeleteEntity, onDeleteZone, onRotateEntity, onRenameZone,
}: MapCanvas2DProps) {
  const cellSize = 32
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)
  const [dragEntityId, setDragEntityId] = useState<string | null>(null)
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)

  const gridToCell = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    return { x: Math.floor((clientX - rect.left) / cellSize), y: Math.floor((clientY - rect.top) / cellSize) }
  }, [cellSize])

  // Keyboard: R=rotate, Delete=delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (selectedEntityId) {
          e.preventDefault()
          onRotateEntity(selectedEntityId)
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEntityId) {
          e.preventDefault()
          onDeleteEntity(selectedEntityId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEntityId, onRotateEntity, onDeleteEntity])

  const findZoneAt = useCallback((cell: { x: number; y: number }): Zone | null => {
    return model.zones.find((z) =>
      cell.x >= z.bounds.x1 && cell.x <= z.bounds.x2 &&
      cell.y >= z.bounds.y1 && cell.y <= z.bounds.y2,
    ) || null
  }, [model.zones])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const cell = gridToCell(e.clientX, e.clientY, rect)

      // Right-click on zone → delete
      if (e.button === 2) {
        e.preventDefault()
        const zone = findZoneAt(cell)
        if (zone) onDeleteZone(zone.id)
        return
      }

      // Double-click on zone → rename
      if (e.detail === 2 && mode === 'select') {
        const zone = findZoneAt(cell)
        if (zone) {
          const name = prompt('房间名称:', zone.name || '')
          if (name !== null && name.trim()) onRenameZone(zone.id, name.trim())
        }
        return
      }

      if (mode === 'select') {
        const clicked = model.entities.find((ent) => {
          const def = getEntityDef(ent.defId)
          if (!def) return false
          return cell.x >= ent.gridX && cell.x < ent.gridX + def.size.w &&
                 cell.y >= ent.gridY && cell.y < ent.gridY + def.size.h
        })
        if (clicked) {
          onSelectEntity(clicked.id)
          setDragEntityId(clicked.id)
          setDragStart(cell)
        } else {
          onSelectEntity(null)
        }
      }

      if (mode === 'draw-room') {
        setDragStart(cell)
        setDragCurrent(cell)
      }

      if (typeof mode === 'object' && mode.type === 'place-entity') {
        const def = getEntityDef(mode.defId)
        if (!def) return
        const result = canPlaceEntity(model, def, cell.x, cell.y)
        if (result.valid) {
          onAddEntity({
            id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            defId: mode.defId,
            gridX: cell.x,
            gridY: cell.y,
            layer: def.layer,
            orientation: def.defaultOrientation,
            status: 'normal',
          })
        }
      }
    },
    [mode, model, gridToCell, findZoneAt, onSelectEntity, onAddEntity, onDeleteZone],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const cell = gridToCell(e.clientX, e.clientY, rect)
      setHoverCell(cell)

      if (dragStart && mode === 'draw-room') setDragCurrent(cell)

      if (dragEntityId && dragStart) {
        const dx = cell.x - dragStart.x
        const dy = cell.y - dragStart.y
        if (dx !== 0 || dy !== 0) {
          const ent = model.entities.find((e) => e.id === dragEntityId)
          if (ent) {
            const def = getEntityDef(ent.defId)
            const newX = Math.max(0, Math.min(model.width - (def?.size.w || 1), ent.gridX + dx))
            const newY = Math.max(0, Math.min(model.height - (def?.size.h || 1), ent.gridY + dy))
            onMoveEntity(dragEntityId, newX, newY)
            setDragStart(cell)
          }
        }
      }
    },
    [dragStart, dragEntityId, mode, model, gridToCell, onMoveEntity],
  )

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  const handleMouseUp = useCallback(() => {
    if (dragStart && dragCurrent && mode === 'draw-room') {
      const x1 = Math.min(dragStart.x, dragCurrent.x)
      const y1 = Math.min(dragStart.y, dragCurrent.y)
      const x2 = Math.max(dragStart.x, dragCurrent.x)
      const y2 = Math.max(dragStart.y, dragCurrent.y)
      if (x2 - x1 >= 2 && y2 - y1 >= 2) {
        onAddZone({
          id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          defId: zoneDefId,
          name: '新房间',
          bounds: { x1, y1, x2, y2 },
        })
      }
    }
    setDragStart(null)
    setDragCurrent(null)
    setDragEntityId(null)
  }, [dragStart, dragCurrent, mode, zoneDefId, onAddZone])

  const showPreview = dragStart && dragCurrent && mode === 'draw-room'
  const w = model.width * cellSize
  const h = model.height * cellSize

  return (
    <div
      style={{ position: 'relative', width: w, height: h, overflow: 'hidden', cursor: mode === 'draw-room' ? 'crosshair' : mode === 'select' ? 'default' : 'cell' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <MapRenderer2D model={model} cellSize={cellSize} showGrid runtimes={runtimes} />

      {hoverCell && typeof mode === 'object' && mode.type === 'place-entity' && (() => {
        const def = getEntityDef(mode.defId)
        if (!def) return null
        const valid = canPlaceEntity(model, def, hoverCell.x, hoverCell.y).valid
        return (
          <div style={{
            position: 'absolute',
            left: hoverCell.x * cellSize, top: hoverCell.y * cellSize,
            width: def.size.w * cellSize, height: def.size.h * cellSize,
            border: `2px solid ${valid ? '#4caf50' : '#f44336'}`,
            background: valid ? 'rgba(76,175,80,0.25)' : 'rgba(244,67,54,0.25)',
            pointerEvents: 'none', zIndex: 10,
          }}>
            <div style={{
              position: 'absolute', bottom: -18, left: 0, right: 0,
              textAlign: 'center', fontSize: 10, color: valid ? '#2e7d32' : '#c62828',
              whiteSpace: 'nowrap',
            }}>
              {def.label} {valid ? '✓' : '✗'}
            </div>
          </div>
        )
      })()}

      {showPreview && (
        <div style={{
          position: 'absolute',
          left: Math.min(dragStart!.x, dragCurrent!.x) * cellSize,
          top: Math.min(dragStart!.y, dragCurrent!.y) * cellSize,
          width: (Math.abs(dragCurrent!.x - dragStart!.x) + 1) * cellSize,
          height: (Math.abs(dragCurrent!.y - dragStart!.y) + 1) * cellSize,
          border: '2px dashed #1976d2',
          background: 'rgba(25,118,210,0.12)',
          pointerEvents: 'none', zIndex: 10,
        }}>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#1565c0', fontSize: 12, fontWeight: 600, opacity: 0.7,
          }}>
            {Math.abs(dragCurrent!.x - dragStart!.x) + 1}×{Math.abs(dragCurrent!.y - dragStart!.y) + 1}
          </div>
        </div>
      )}

      {selectedEntityId && (() => {
        const ent = model.entities.find((e) => e.id === selectedEntityId)
        if (!ent) return null
        const def = getEntityDef(ent.defId)
        if (!def) return null
        return (
          <div style={{
            position: 'absolute',
            left: ent.gridX * cellSize, top: ent.gridY * cellSize,
            width: def.size.w * cellSize, height: def.size.h * cellSize,
            border: '2px solid #1976d2', pointerEvents: 'none', zIndex: 10,
            boxShadow: '0 0 0 1px rgba(25,118,210,0.3)',
          }} />
        )
      })()}
    </div>
  )
}
