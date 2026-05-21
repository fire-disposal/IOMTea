import type { AvatarSpec } from '@iomtea/shared-types'

export type SvgNode = {
  tag: string
  attrs?: Record<string, string | number>
  children?: SvgNode[]
  text?: string
}

export type AvatarRenderOptions = {
  size?: number
  includeXmlHeader?: boolean
}

export type AvatarPartDefinition = {
  id: string
  layer: 'base' | 'face' | 'eyes' | 'brows' | 'nose' | 'mouth' | 'hair' | 'accessory' | 'effects'
  styleKeys?: string[]
  render: (spec: AvatarSpec) => SvgNode[]
}
