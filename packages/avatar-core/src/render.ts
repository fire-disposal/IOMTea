import type { AvatarSpec } from '@iomtea/shared-types'
import { AvatarSpecSchema } from '@iomtea/shared-types'
import { serializeSvgNode } from './ast'
import { CLOTHING_TONES, EYE_COLORS, HAIR_COLORS, PALETTE_COLORS, SKIN_TONES } from './tokens'
import type { AvatarRenderOptions, SvgNode } from './types'

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

const facePath = (shape: AvatarSpec['face']['shape'], jawRoundness: number) => {
  const jaw = 28 + (1 - jawRoundness) * 18
  if (shape === 'round')
    return `M128 56c42 0 68 26 68 72 0 ${jaw} -31 70 -68 70s-68-${jaw} -68-70c0-46 26-72 68-72z`
  if (shape === 'square')
    return `M70 64h116a22 22 0 0 1 22 22v68c0 37-28 66-62 66h-36c-34 0-62-29-62-66V86a22 22 0 0 1 22-22z`
  return `M128 58c45 0 72 28 72 78 0 48-31 78-72 78s-72-30-72-78c0-50 27-78 72-78z`
}

const hairPath = (style: AvatarSpec['hair']['style']) => {
  switch (style) {
    case 'long':
      return 'M56 126c0-53 31-82 72-82s72 29 72 82v88H56z'
    case 'buzz':
      return 'M74 88c10-24 33-38 54-38s44 14 54 38l-10 12H84z'
    case 'curly':
      return 'M58 112c4-40 33-66 70-66 40 0 70 28 72 66-7-8-16-12-26-12-10 0-19 4-25 11-7-7-16-11-27-11-10 0-19 4-25 11-6-7-15-11-25-11-5 0-10 1-14 4z'
    default:
      return 'M64 112c0-43 28-68 64-68 39 0 64 24 64 68l-16 8H80z'
  }
}

const eyeShape = (
  style: AvatarSpec['eyes']['style'],
  x: number,
  y: number,
  rx: number,
  ry: number,
): SvgNode => {
  if (style === 'smile') {
    return {
      tag: 'path',
      attrs: {
        d: `M${x - rx} ${y} Q ${x} ${y + ry} ${x + rx} ${y}`,
        fill: 'none',
        stroke: '#1B1B1B',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      },
    }
  }

  if (style === 'almond') {
    return {
      tag: 'path',
      attrs: {
        d: `M${x - rx} ${y} Q ${x} ${y - ry} ${x + rx} ${y} Q ${x} ${y + ry} ${x - rx} ${y}z`,
        fill: '#fff',
        stroke: '#1B1B1B',
        'stroke-width': 2,
      },
    }
  }

  return {
    tag: 'ellipse',
    attrs: { cx: x, cy: y, rx, ry, fill: '#fff', stroke: '#1B1B1B', 'stroke-width': 2 },
  }
}

const browPath = (
  style: AvatarSpec['brows']['style'],
  x: number,
  y: number,
  width: number,
  angle: number,
) => {
  const y2 = y - angle * 8
  if (style === 'flat') return `M${x - width} ${y} L ${x + width} ${y}`
  if (style === 'sharp') return `M${x - width} ${y + 2} L ${x} ${y2 - 2} L ${x + width} ${y2}`
  return `M${x - width} ${y + 1} Q ${x} ${y2} ${x + width} ${y + 1}`
}

const noseNode = (spec: AvatarSpec): SvgNode => {
  const width = 7 * spec.nose.width
  const height = 9 * spec.nose.height

  if (spec.nose.style === 'dot') {
    return { tag: 'circle', attrs: { cx: 128, cy: 142, r: 3.4 * spec.nose.width, fill: '#BC8263' } }
  }

  if (spec.nose.style === 'long') {
    return {
      tag: 'path',
      attrs: {
        d: `M128 131 L${128 - width / 2} ${131 + height} Q128 ${131 + height + 4} ${128 + width / 2} ${131 + height}`,
        fill: 'none',
        stroke: '#A06C52',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      },
    }
  }

  return {
    tag: 'path',
    attrs: {
      d: `M${128 - width / 2} 140 Q128 ${140 + height / 2} ${128 + width / 2} 140`,
      fill: 'none',
      stroke: '#A06C52',
      'stroke-width': 2,
      'stroke-linecap': 'round',
    },
  }
}

const mouthNode = (spec: AvatarSpec): SvgNode => {
  const width = 18 * spec.mouth.width
  const openness = 6 + spec.mouth.openness * 8

  if (spec.mouth.style === 'neutral') {
    return {
      tag: 'line',
      attrs: {
        x1: 128 - width,
        y1: 172,
        x2: 128 + width,
        y2: 172,
        stroke: '#7D3F3A',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      },
    }
  }

  if (spec.mouth.style === 'laugh') {
    return {
      tag: 'path',
      attrs: {
        d: `M${128 - width} 168 Q128 ${168 + openness} ${128 + width} 168 Q128 ${172 + openness} ${128 - width} 168z`,
        fill: '#B34D57',
      },
    }
  }

  return {
    tag: 'path',
    attrs: {
      d: `M${128 - width} 168 Q128 ${168 + openness} ${128 + width} 168`,
      fill: 'none',
      stroke: '#7D3F3A',
      'stroke-width': 3,
      'stroke-linecap': 'round',
    },
  }
}

const glassesNodes = (style: AvatarSpec['accessory']['glasses']): SvgNode[] => {
  if (style === 'none') return []

  if (style === 'square') {
    return [
      {
        tag: 'rect',
        attrs: {
          x: 86,
          y: 112,
          width: 28,
          height: 20,
          rx: 5,
          fill: 'none',
          stroke: '#3A3A3A',
          'stroke-width': 3,
        },
      },
      {
        tag: 'rect',
        attrs: {
          x: 142,
          y: 112,
          width: 28,
          height: 20,
          rx: 5,
          fill: 'none',
          stroke: '#3A3A3A',
          'stroke-width': 3,
        },
      },
      {
        tag: 'line',
        attrs: { x1: 114, y1: 122, x2: 142, y2: 122, stroke: '#3A3A3A', 'stroke-width': 3 },
      },
    ]
  }

  return [
    {
      tag: 'circle',
      attrs: { cx: 100, cy: 122, r: 11, fill: 'none', stroke: '#3A3A3A', 'stroke-width': 3 },
    },
    {
      tag: 'circle',
      attrs: { cx: 156, cy: 122, r: 11, fill: 'none', stroke: '#3A3A3A', 'stroke-width': 3 },
    },
    {
      tag: 'line',
      attrs: { x1: 111, y1: 122, x2: 145, y2: 122, stroke: '#3A3A3A', 'stroke-width': 3 },
    },
  ]
}

const hatNodes = (spec: AvatarSpec): SvgNode[] => {
  if (spec.accessory.hat !== 'beanie') return []
  const color = CLOTHING_TONES[spec.palette.clothing]
  return [
    {
      tag: 'path',
      attrs: { d: 'M66 96c8-36 36-56 62-56 30 0 58 20 66 56l-14 2H80z', fill: color },
    },
    { tag: 'rect', attrs: { x: 74, y: 96, width: 108, height: 14, rx: 7, fill: '#2D2D2D' } },
  ]
}

export function renderAvatarSvgAst(input: AvatarSpec): SvgNode {
  const spec = AvatarSpecSchema.parse(input)
  const skin = SKIN_TONES[spec.face.skinTone]
  const hair = HAIR_COLORS[spec.hair.color]
  const eyeColor = EYE_COLORS[spec.eyes.color]
  const bgColor = PALETTE_COLORS[spec.palette.background]
  const shirt = CLOTHING_TONES[spec.palette.clothing]

  const centerY = 124 - (spec.face.headScale - 1) * 20
  const headScale = spec.face.headScale

  const eyeOffsetX = 26 * spec.eyes.spacing
  const eyeY = centerY - 6 + (0.5 - spec.eyes.height) * 22
  const eyeRx = 9 * spec.eyes.size
  const eyeRy = 6 * spec.eyes.size

  const gradientId = `grad-${spec.seed ?? 0}`

  const defs: SvgNode[] = spec.effects.gradient
    ? [
        {
          tag: 'defs',
          children: [
            {
              tag: 'linearGradient',
              attrs: { id: gradientId, x1: 0, y1: 0, x2: 1, y2: 1 },
              children: [
                { tag: 'stop', attrs: { offset: '0%', 'stop-color': bgColor } },
                { tag: 'stop', attrs: { offset: '100%', 'stop-color': '#FFFFFF' } },
              ],
            },
          ],
        },
      ]
    : []

  const blushNodes = spec.effects.blush
    ? [
        {
          tag: 'ellipse',
          attrs: { cx: 88, cy: centerY + 36, rx: 12, ry: 7, fill: '#F2A8A8', opacity: 0.35 },
        },
        {
          tag: 'ellipse',
          attrs: { cx: 168, cy: centerY + 36, rx: 12, ry: 7, fill: '#F2A8A8', opacity: 0.35 },
        },
      ]
    : []

  return {
    tag: 'svg',
    attrs: {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 256 256',
      fill: 'none',
    },
    children: [
      ...defs,
      {
        tag: 'rect',
        attrs: {
          x: 0,
          y: 0,
          width: 256,
          height: 256,
          fill: spec.effects.gradient ? `url(#${gradientId})` : bgColor,
        },
      },
      {
        tag: 'rect',
        attrs: { x: 62, y: 200, width: 132, height: 64, rx: 28, fill: shirt },
      },
      ...hatNodes(spec),
      {
        tag: 'g',
        attrs: {
          transform: `translate(128 ${centerY}) scale(${headScale}) translate(-128 -${centerY})`,
        },
        children: [
          { tag: 'path', attrs: { d: hairPath(spec.hair.style), fill: hair } },
          {
            tag: 'path',
            attrs: {
              d: facePath(spec.face.shape, spec.face.jawRoundness),
              fill: skin,
              stroke: '#AA7A5C',
              'stroke-width': 1.2,
            },
          },
          ...blushNodes,
          eyeShape(spec.eyes.style, 128 - eyeOffsetX, eyeY, eyeRx, eyeRy),
          eyeShape(spec.eyes.style, 128 + eyeOffsetX, eyeY, eyeRx, eyeRy),
          ...(spec.eyes.style === 'smile'
            ? []
            : [
                {
                  tag: 'circle',
                  attrs: {
                    cx: 128 - eyeOffsetX,
                    cy: eyeY,
                    r: clamp(3.4 * spec.eyes.size, 2, 5),
                    fill: eyeColor,
                  },
                },
                {
                  tag: 'circle',
                  attrs: {
                    cx: 128 + eyeOffsetX,
                    cy: eyeY,
                    r: clamp(3.4 * spec.eyes.size, 2, 5),
                    fill: eyeColor,
                  },
                },
              ]),
          {
            tag: 'path',
            attrs: {
              d: browPath(
                spec.brows.style,
                128 - eyeOffsetX,
                eyeY - 17,
                10 * spec.brows.thickness,
                spec.brows.angle,
              ),
              fill: 'none',
              stroke: '#3C2B1D',
              'stroke-width': 3,
              'stroke-linecap': 'round',
            },
          },
          {
            tag: 'path',
            attrs: {
              d: browPath(
                spec.brows.style,
                128 + eyeOffsetX,
                eyeY - 17,
                10 * spec.brows.thickness,
                -spec.brows.angle,
              ),
              fill: 'none',
              stroke: '#3C2B1D',
              'stroke-width': 3,
              'stroke-linecap': 'round',
            },
          },
          noseNode(spec),
          mouthNode(spec),
          ...glassesNodes(spec.accessory.glasses),
        ],
      },
      {
        tag: 'ellipse',
        attrs: { cx: 128, cy: 240, rx: 48, ry: 10, fill: '#000', opacity: 0.08 },
      },
    ],
  }
}

export function renderAvatarSvg(spec: AvatarSpec, options: AvatarRenderOptions = {}): string {
  const root = renderAvatarSvgAst(spec)
  const xml = serializeSvgNode(root)
  const { size, includeXmlHeader } = options

  let sized = xml
  if (size) {
    sized = xml.replace('<svg ', `<svg width="${size}" height="${size}" `)
  }

  return includeXmlHeader ? `<?xml version="1.0" encoding="UTF-8"?>${sized}` : sized
}
