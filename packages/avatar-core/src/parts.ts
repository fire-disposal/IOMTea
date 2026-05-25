import type { AvatarPartDefinition } from './types'

export type AvatarPartManifestItem = {
  id: string
  layer: AvatarPartDefinition['layer']
  description: string
  styles?: string[]
}

export const AVATAR_PART_MANIFEST: AvatarPartManifestItem[] = [
  { id: 'background', layer: 'base', description: 'Base background and gradient tokens' },
  { id: 'clothing', layer: 'base', description: 'Shoulder and clothing silhouette' },
  {
    id: 'face-shape',
    layer: 'face',
    description: 'Front-face geometry',
    styles: ['round', 'oval', 'square'],
  },
  { id: 'eyes', layer: 'eyes', description: 'Eye component', styles: ['round', 'almond', 'smile'] },
  {
    id: 'brows',
    layer: 'brows',
    description: 'Eyebrow component',
    styles: ['soft', 'flat', 'sharp'],
  },
  { id: 'nose', layer: 'nose', description: 'Nose component', styles: ['dot', 'small', 'long'] },
  {
    id: 'mouth',
    layer: 'mouth',
    description: 'Mouth component',
    styles: ['smile', 'neutral', 'laugh'],
  },
  {
    id: 'hair',
    layer: 'hair',
    description: 'Hair component',
    styles: ['short', 'long', 'buzz', 'curly'],
  },
  {
    id: 'glasses',
    layer: 'accessory',
    description: 'Glasses component',
    styles: ['none', 'round', 'square'],
  },
  { id: 'hat', layer: 'accessory', description: 'Hat component', styles: ['none', 'beanie'] },
  { id: 'effects', layer: 'effects', description: 'Blush and shadows' },
]
