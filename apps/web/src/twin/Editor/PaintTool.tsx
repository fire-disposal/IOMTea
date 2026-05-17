import { type TileFlag, type HomeMapRuntime, placeTile } from '@iomtea/shared-types'
import { HomeMapCanvas } from '../HomeMapCanvas'
import type { PaintType } from './EditorTypes'

interface PaintToolProps {
  runtime: HomeMapRuntime
  workingGrid: TileFlag[][]
  paintType: PaintType
  onGridChanged: (newGrid: TileFlag[][]) => void
}

export function PaintTool({ runtime, workingGrid, paintType, onGridChanged }: PaintToolProps) {
  return (
    <HomeMapCanvas
      runtime={runtime}
      tileGridOverride={workingGrid}
      cellSize={36}
      onTileClick={(x, y) => {
        const newGrid = placeTile(workingGrid, x, y, paintType as TileFlag)
        onGridChanged(newGrid)
      }}
    />
  )
}
