import React, { useRef, useEffect, useCallback } from 'react'
import { type HomeMapRuntime, TileFlag, getThingDef } from '@iomtea/shared-types'

interface HomeMapCanvasProps {
  runtime: HomeMapRuntime
  cellSize?: number
  showRoomOverlay?: boolean
  selectedRoomId?: string
  onTileClick?: (x: number, y: number) => void
  tileGridOverride?: import('@iomtea/shared-types').TileFlag[][]
}

const ROOM_COLORS: Record<string, string> = {
  bedroom: 'rgba(100, 149, 237, 0.15)',
  livingroom: 'rgba(60, 179, 113, 0.15)',
  kitchen: 'rgba(255, 165, 0, 0.15)',
  bathroom: 'rgba(0, 191, 255, 0.15)',
  entry: 'rgba(218, 165, 32, 0.15)',
  hallway: 'rgba(169, 169, 169, 0.15)',
  balcony: 'rgba(144, 238, 144, 0.15)',
  dining: 'rgba(255, 218, 185, 0.15)',
  study: 'rgba(221, 160, 221, 0.15)',
  storage: 'rgba(119, 136, 153, 0.15)',
}

const WALL_COLOR = '#5c4a3a'
const FLOOR_COLOR = '#f5f0e8'
const VOID_COLOR = '#2a2a2a'
const DOOR_COLOR = '#8b7355'

function getRoomColor(roomType: string): string {
  return (ROOM_COLORS as any)[roomType] || 'rgba(200,200,200,0.1)'
}

export function HomeMapCanvas({
  runtime, cellSize = 40, showRoomOverlay = false,
  selectedRoomId, onTileClick, tileGridOverride: tgo,
}: HomeMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const tileGrid = tgo ?? runtime.tileGrid
    const { rooms, things } = runtime
    const h = tileGrid.length
    const w = tileGrid[0]?.length ?? 0

    canvas.width = w * cellSize
    canvas.height = h * cellSize

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const flag = tileGrid[y][x]
        ctx.fillStyle = flag === TileFlag.VOID ? VOID_COLOR
          : flag === TileFlag.WALL ? WALL_COLOR
          : flag === TileFlag.DOOR ? DOOR_COLOR
          : FLOOR_COLOR
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
      }
    }

    if (showRoomOverlay) {
      for (const room of rooms) {
        if (selectedRoomId && room.id !== selectedRoomId) continue
        ctx.fillStyle = selectedRoomId === room.id
          ? 'rgba(255, 102, 0, 0.2)' : getRoomColor(room.type)
        for (const tileKey of room.tiles) {
          const [tx, ty] = tileKey.split(',').map(Number)
          ctx.fillRect(tx * cellSize, ty * cellSize, cellSize, cellSize)
        }
      }
    }

    for (const thing of things) {
      const def = getThingDef(thing.thingType)
      const x = thing.tileX * cellSize
      const y = thing.tileY * cellSize
      const w2 = thing.tileW * cellSize
      const h2 = thing.tileH * cellSize

      ctx.fillStyle = '#4a90d9'
      ctx.fillRect(x + 2, y + 2, w2 - 4, h2 - 4)
      ctx.strokeStyle = '#2d6db5'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 2, y + 2, w2 - 4, h2 - 4)

      ctx.fillStyle = '#ffffff'
      ctx.font = `${Math.min(cellSize * 0.3, 12)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(def?.label || thing.thingType, x + w2 / 2, y + h2 / 2)
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= w; x++) {
      ctx.beginPath(); ctx.moveTo(x * cellSize, 0); ctx.lineTo(x * cellSize, h * cellSize); ctx.stroke()
    }
    for (let y = 0; y <= h; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cellSize); ctx.lineTo(w * cellSize, y * cellSize); ctx.stroke()
    }

  }, [runtime, cellSize, showRoomOverlay, selectedRoomId, tgo])

  useEffect(() => { draw() }, [draw])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onTileClick || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / cellSize)
    const y = Math.floor((e.clientY - rect.top) / cellSize)
    onTileClick(x, y)
  }, [cellSize, onTileClick])

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ border: '1px solid #ccc', cursor: onTileClick ? 'pointer' : 'default' }}
    />
  )
}
