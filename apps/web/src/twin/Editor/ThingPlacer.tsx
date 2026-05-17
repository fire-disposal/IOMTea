import { useCallback, useState } from 'react'
import { type TileFlag, type HomeMapRuntime, getThingDef, canPlaceThing } from '@iomtea/shared-types'
import { HomeMapCanvas } from '../HomeMapCanvas'

interface ThingPlacerProps {
  runtime: HomeMapRuntime
  workingGrid: TileFlag[][]
  selectedThingDef: string
  onThingPlaced: (thingType: string, x: number, y: number) => void
}

export function ThingPlacer({ runtime, workingGrid, selectedThingDef, onThingPlaced }: ThingPlacerProps) {
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)
  const def = getThingDef(selectedThingDef)

  const handleTileClick = useCallback((x: number, y: number) => {
    if (!def) return
    const result = canPlaceThing(workingGrid, runtime.things, def, x, y)
    if (result.ok) {
      onThingPlaced(selectedThingDef, x, y)
    }
  }, [def, workingGrid, runtime.things, selectedThingDef, onThingPlaced])

  return (
    <div style={{ position: 'relative' }}>
      <HomeMapCanvas
        runtime={runtime}
        tileGridOverride={workingGrid}
        cellSize={36}
        onTileClick={handleTileClick}
      />
      {hoverCell && def && (
        <div
          style={{
            position: 'absolute',
            left: hoverCell.x * 36,
            top: hoverCell.y * 36,
            width: def.tileW * 36,
            height: def.tileH * 36,
            border: '2px solid #4caf50',
            background: 'rgba(76,175,80,0.2)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      )}
    </div>
  )
}
