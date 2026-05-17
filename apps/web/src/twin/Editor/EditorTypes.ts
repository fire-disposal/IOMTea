import { TileFlag } from '@iomtea/shared-types'

export type EditorMode = 'paint' | 'thing' | 'select'
export type PaintType = TileFlag.FLOOR | TileFlag.WALL | TileFlag.DOOR | TileFlag.VOID

export interface EditorState {
  mode: EditorMode
  paintType: PaintType
  selectedThingDef: string | null
  selectedThingId: string | null
  dirty: boolean
}
