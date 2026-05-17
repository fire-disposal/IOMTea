export const enum TileFlag {
  VOID  = 0b00,
  FLOOR = 0b01,
  WALL  = 0b10,
  DOOR  = 0b11,
}

export type TagValue = string | number | boolean | TagValue[] | { [key: string]: TagValue }

export interface TagCompound {
  [key: string]: TagValue
}

export interface Thing {
  id: string
  thingType: string
  tileX: number
  tileY: number
  tileW: number
  tileH: number
  rotation: 0 | 1 | 2 | 3
  deviceId: string | null
  tags: TagCompound
  config: TagCompound
}

export interface HomeMap {
  id: string
  patientId: string
  templateId: string | null
  packedGrid: string
  createdAt: string
  updatedAt: string
}

export interface DetectedRoom {
  id: string
  tiles: string[]
  area: number
  type: RoomType
  label: string
  doors: { doorThingId: string; connectsToRoomId: string }[]
}

export type RoomType = 'bedroom' | 'livingroom' | 'kitchen' | 'bathroom' | 'entry' | 'hallway' | 'balcony' | 'dining' | 'study' | 'storage' | 'outside'

export interface RoomGraph {
  nodes: DetectedRoom[]
  adjacency: Map<string, string[]>
  edgeDoors: Map<string, string[]>
}

export interface ThingDef {
  type: string
  label: string
  tileW: number
  tileH: number
  category: 'structure' | 'device' | 'furnishing'
  defaultTags: TagCompound
}

export interface HomeTemplateDef {
  id: string
  label: string
  width: number
  height: number
  tiles: TileFlag[][]
  things: TemplateThing[]
}

export interface TemplateThing {
  type: string
  tileX: number
  tileY: number
  tileW?: number
  tileH?: number
}

export type PackedGrid = string

export interface RoomDetectResult {
  rooms: DetectedRoom[]
  graph: RoomGraph
}
