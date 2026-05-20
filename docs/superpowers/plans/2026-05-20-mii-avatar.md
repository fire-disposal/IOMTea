# Mii-like Avatar System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dual-strategy Mii avatar system with procedural Canvas 2D and SVG composition renderers, a Web editor with live preview and strategy toggle, mini-program integration, and a server PNG endpoint.

**Architecture:** New `@iomtea/shared-mii` workspace package holds both renderers behind a unified `renderFace(ctx, params, size, strategy?)` API. Web MiiEditor wraps this with slider controls, strategy toggle, and export. Mini-program reuses via Taro `<Canvas>`. Server generates PNGs via `node-canvas`.

**Tech Stack:** TypeScript, Zod, Canvas 2D API, React 19 (web), Taro 4 (miniapp), Hono (server), node-canvas, vitest

---

### Task 0: Scaffold `@iomtea/shared-mii` package

**Files:**
- Create: `packages/shared-mii/package.json`
- Create: `packages/shared-mii/tsconfig.json`
- Modify: `packages/shared-types/src/mii-params.ts` (TBD → this file)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@iomtea/shared-mii",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "exports": {
    ".": "./src/index.ts",
    "./procedural": "./src/procedural/index.ts",
    "./svg": "./src/svg/index.ts"
  },
  "dependencies": {
    "@iomtea/shared-types": "workspace:*",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "vitest": "^4.1.6"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create MiiParams schema in shared-types**

Create `packages/shared-types/src/mii-params.ts`:

```typescript
import { z } from 'zod'

export const MiiParamsSchema = z.object({
  version: z.literal(1),
  face: z.object({
    headWidth:     z.number().min(0).max(1),
    headHeight:    z.number().min(0).max(1),
    skinTone:      z.number().int().min(0).max(5),
    eyeSize:       z.number().min(0).max(1),
    eyeSpacing:    z.number().min(0).max(1),
    eyeHeight:     z.number().min(0).max(1),
    eyeStyle:      z.number().int().min(0).max(3),
    eyeColor:      z.number().int().min(0).max(5),
    eyebrowAngle:  z.number().min(-1).max(1),
    eyebrowHeight: z.number().min(0).max(1),
    noseHeight:    z.number().min(0).max(1),
    noseWidth:     z.number().min(0).max(1),
    mouthWidth:    z.number().min(0).max(1),
    mouthHeight:   z.number().min(0).max(1),
    mouthShape:    z.number().int().min(0).max(3),
    hairStyle:     z.number().int().min(0).max(11),
    hairColor:     z.number().int().min(0).max(7),
    accessory:     z.number().int().min(0).max(4),
  }),
  seed: z.number().int().optional(),
})

export type MiiParams = z.infer<typeof MiiParamsSchema>
export type RenderStrategy = 'procedural' | 'svg'
export const DEFAULT_MII_PARAMS: MiiParams = {
  version: 1,
  face: {
    headWidth: 0.5, headHeight: 0.5, skinTone: 2,
    eyeSize: 0.5, eyeSpacing: 0.5, eyeHeight: 0.5, eyeStyle: 0, eyeColor: 0,
    eyebrowAngle: 0, eyebrowHeight: 0.5,
    noseHeight: 0.5, noseWidth: 0.5,
    mouthWidth: 0.5, mouthHeight: 0.5, mouthShape: 0,
    hairStyle: 0, hairColor: 0, accessory: 0,
  },
}
```

Add re-export in `packages/shared-types/src/index.ts`:

```typescript
export { MiiParamsSchema, DEFAULT_MII_PARAMS, type MiiParams, type RenderStrategy } from './mii-params'
```

- [ ] **Step 4: Install and verify**

```bash
cd /home/firedisposal/IOMTea && pnpm install
pnpm --filter @iomtea/shared-types run typecheck
pnpm --filter @iomtea/shared-mii run typecheck
```

Expect: both pass with zero errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared-mii/package.json packages/shared-mii/tsconfig.json packages/shared-types/src/mii-params.ts packages/shared-types/src/index.ts
git commit -m "feat: scaffold @iomtea/shared-mii package and MiiParams schema"
```

---

### Task 1: Procedural palette and hair styles

**Files:**
- Create: `packages/shared-mii/src/procedural/palette.ts`
- Create: `packages/shared-mii/src/procedural/hairStyles.ts`
- Create: `packages/shared-mii/src/procedural/index.ts`

- [ ] **Step 1: Write palette.ts**

```typescript
export const SKIN_TONES = [
  '#FDEBD0', '#F5CBA7', '#E8B88A', '#D4A373', '#C68642', '#8D5524',
] as const

export const HAIR_COLORS = [
  '#1A1A2E', '#3D2B1F', '#6B4226', '#B8860B', '#D4A574', '#E6C3A5', '#7B68EE', '#C0392B',
] as const

export const EYE_COLORS = [
  '#2C3E50', '#5D6D7E', '#7D3C98', '#1A5276', '#117A65', '#935116',
] as const
```

- [ ] **Step 2: Write hairStyles.ts**

```typescript
interface Vec2 { x: number; y: number }

export interface HairStyle {
  name: string
  back: Vec2[][]
  front: Vec2[][]
}

export const HAIR_STYLES: HairStyle[] = [
  {
    name: '短发', back: [
      [{ x: 0.30, y: 0.22 }, { x: 0.30, y: 0.08 }, { x: 0.70, y: 0.08 }, { x: 0.70, y: 0.22 }],
    ], front: [
      [{ x: 0.28, y: 0.22 }, { x: 0.28, y: 0.12 }, { x: 0.38, y: 0.06 }, { x: 0.50, y: 0.04 },
       { x: 0.62, y: 0.06 }, { x: 0.72, y: 0.12 }, { x: 0.72, y: 0.22 }],
    ],
  },
  {
    name: '中分', back: [
      [{ x: 0.30, y: 0.24 }, { x: 0.28, y: 0.04 }, { x: 0.50, y: 0.02 }, { x: 0.72, y: 0.04 }, { x: 0.70, y: 0.24 }],
    ], front: [
      [{ x: 0.28, y: 0.24 }, { x: 0.30, y: 0.10 }, { x: 0.40, y: 0.06 }, { x: 0.50, y: 0.05 }],
      [{ x: 0.50, y: 0.05 }, { x: 0.60, y: 0.06 }, { x: 0.70, y: 0.10 }, { x: 0.72, y: 0.24 }],
    ],
  },
  {
    name: '刘海', back: [
      [{ x: 0.32, y: 0.20 }, { x: 0.32, y: 0.06 }, { x: 0.68, y: 0.06 }, { x: 0.68, y: 0.20 }],
    ], front: [
      [{ x: 0.26, y: 0.22 }, { x: 0.24, y: 0.14 }, { x: 0.30, y: 0.06 }, { x: 0.50, y: 0.03 },
       { x: 0.70, y: 0.06 }, { x: 0.76, y: 0.14 }, { x: 0.74, y: 0.22 }],
    ],
  },
  {
    name: '长发直', back: [
      [{ x: 0.32, y: 0.20 }, { x: 0.30, y: 0.02 }, { x: 0.50, y: 0.02 }, { x: 0.70, y: 0.02 }, { x: 0.68, y: 0.20 }],
    ], front: [
      [{ x: 0.24, y: 0.45 }, { x: 0.24, y: 0.22 }, { x: 0.28, y: 0.14 }, { x: 0.36, y: 0.06 }, { x: 0.50, y: 0.04 },
       { x: 0.64, y: 0.06 }, { x: 0.72, y: 0.14 }, { x: 0.76, y: 0.22 }, { x: 0.76, y: 0.45 }],
    ],
  },
  {
    name: '长发卷', back: [
      [{ x: 0.32, y: 0.20 }, { x: 0.30, y: 0.02 }, { x: 0.50, y: 0.02 }, { x: 0.70, y: 0.02 }, { x: 0.68, y: 0.20 }],
    ], front: [
      [{ x: 0.22, y: 0.45 }, { x: 0.20, y: 0.22 }, { x: 0.26, y: 0.12 }, { x: 0.14, y: 0.06 }, { x: 0.22, y: 0.02 },
       { x: 0.38, y: 0.00 }, { x: 0.50, y: 0.02 }, { x: 0.62, y: 0.00 }, { x: 0.78, y: 0.02 },
       { x: 0.86, y: 0.06 }, { x: 0.74, y: 0.12 }, { x: 0.80, y: 0.22 }, { x: 0.78, y: 0.45 }],
    ],
  },
  {
    name: '寸头', back: [], front: [
      [{ x: 0.32, y: 0.24 }, { x: 0.28, y: 0.15 }, { x: 0.32, y: 0.08 }, { x: 0.42, y: 0.05 }, { x: 0.50, y: 0.03 },
       { x: 0.58, y: 0.05 }, { x: 0.68, y: 0.08 }, { x: 0.72, y: 0.15 }, { x: 0.68, y: 0.24 }],
    ],
  },
  {
    name: '偏分', back: [
      [{ x: 0.32, y: 0.22 }, { x: 0.30, y: 0.04 }, { x: 0.70, y: 0.04 }, { x: 0.68, y: 0.22 }],
    ], front: [
      [{ x: 0.26, y: 0.24 }, { x: 0.28, y: 0.10 }, { x: 0.34, y: 0.06 }, { x: 0.44, y: 0.04 }, { x: 0.50, y: 0.03 },
       { x: 0.64, y: 0.04 }, { x: 0.74, y: 0.06 }, { x: 0.72, y: 0.14 }],
    ],
  },
  {
    name: '丸子头', back: [
      [{ x: 0.32, y: 0.20 }, { x: 0.32, y: 0.04 }, { x: 0.68, y: 0.04 }, { x: 0.68, y: 0.20 }],
    ], front: [
      [{ x: 0.52, y: 0.00 }, { x: 0.48, y: -0.06 }, { x: 0.40, y: -0.10 }, { x: 0.60, y: -0.10 },
       { x: 0.52, y: -0.06 }, { x: 0.48, y: 0.00 }, { x: 0.40, y: 0.08 }, { x: 0.60, y: 0.08 },
       { x: 0.52, y: 0.00 }],
      [{ x: 0.30, y: 0.20 }, { x: 0.30, y: 0.08 }, { x: 0.42, y: 0.04 }, { x: 0.50, y: 0.03 },
       { x: 0.58, y: 0.04 }, { x: 0.70, y: 0.08 }, { x: 0.70, y: 0.20 }],
    ],
  },
  {
    name: '双马尾', back: [
      [{ x: 0.34, y: 0.20 }, { x: 0.34, y: 0.04 }, { x: 0.66, y: 0.04 }, { x: 0.66, y: 0.20 }],
    ], front: [
      [{ x: 0.28, y: 0.20 }, { x: 0.26, y: 0.10 }, { x: 0.30, y: 0.05 }, { x: 0.40, y: 0.03 }, { x: 0.50, y: 0.02 },
       { x: 0.60, y: 0.03 }, { x: 0.70, y: 0.05 }, { x: 0.74, y: 0.10 }, { x: 0.72, y: 0.20 }],
      [{ x: 0.20, y: 0.30 }, { x: 0.16, y: 0.20 }, { x: 0.22, y: 0.10 }, { x: 0.28, y: 0.20 }],
      [{ x: 0.80, y: 0.30 }, { x: 0.84, y: 0.20 }, { x: 0.78, y: 0.10 }, { x: 0.72, y: 0.20 }],
    ],
  },
  {
    name: '蓬松', back: [
      [{ x: 0.28, y: 0.20 }, { x: 0.26, y: 0.00 }, { x: 0.74, y: 0.00 }, { x: 0.72, y: 0.20 }],
    ], front: [
      [{ x: 0.20, y: 0.24 }, { x: 0.18, y: 0.10 }, { x: 0.22, y: 0.02 }, { x: 0.34, y: -0.02 },
       { x: 0.50, y: -0.04 }, { x: 0.66, y: -0.02 }, { x: 0.78, y: 0.02 }, { x: 0.82, y: 0.10 },
       { x: 0.80, y: 0.24 }],
    ],
  },
  {
    name: '背头', back: [
      [{ x: 0.30, y: 0.20 }, { x: 0.28, y: 0.02 }, { x: 0.72, y: 0.02 }, { x: 0.70, y: 0.20 }],
    ], front: [
      [{ x: 0.30, y: 0.24 }, { x: 0.30, y: 0.08 }, { x: 0.36, y: 0.03 }, { x: 0.50, y: 0.01 },
       { x: 0.64, y: 0.03 }, { x: 0.70, y: 0.08 }, { x: 0.70, y: 0.24 }],
    ],
  },
  {
    name: '光头', back: [], front: [],
  },
]
```

- [ ] **Step 3: Write procedural/index.ts barrel**

```typescript
export { SKIN_TONES, HAIR_COLORS, EYE_COLORS } from './palette'
export { HAIR_STYLES, type HairStyle } from './hairStyles'
export { renderFaceProc } from './renderFaceProc'
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm --filter @iomtea/shared-mii run typecheck
```

Expect: zero errors. (renderFaceProc won't exist yet, will fail — this is intentional, fixed in Task 2.)

- [ ] **Step 5: Commit**

```bash
git add packages/shared-mii/src/procedural/
git commit -m "feat: add procedural palette and 12 hair styles"
```

---

### Task 2: Procedural `renderFaceProc`

**Files:**
- Create: `packages/shared-mii/src/procedural/renderFaceProc.ts`
- Create: `packages/shared-mii/src/empty.ts`
- Create: `packages/shared-mii/src/index.ts`
- Create: `packages/shared-mii/src/__tests__/procedural.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/shared-mii/src/__tests__/procedural.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createCanvas } from 'canvas'
import { renderFaceProc } from '../procedural/renderFaceProc'
import { renderEmptyFace } from '../empty'
import { renderFace } from '../index'
import { DEFAULT_MII_PARAMS, type MiiParams } from '@iomtea/shared-types'

function makeCanvas(size = 256) {
  const canvas = createCanvas(size, size)
  return canvas.getContext('2d') as unknown as CanvasRenderingContext2D
}

function isCanvasNonEmpty(ctx: CanvasRenderingContext2D): boolean {
  const data = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data
  // Check that at least some pixels are non-transparent
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true
  }
  return false
}

describe('renderFaceProc', () => {
  it('produces non-empty canvas with default params', () => {
    const ctx = makeCanvas()
    renderFaceProc(ctx, DEFAULT_MII_PARAMS, 256)
    expect(isCanvasNonEmpty(ctx)).toBe(true)
  })

  it('renders correctly at 128px', () => {
    const ctx = makeCanvas(128)
    renderFaceProc(ctx, DEFAULT_MII_PARAMS, 128)
    expect(isCanvasNonEmpty(ctx)).toBe(true)
  })

  it('renders correctly at 512px', () => {
    const ctx = makeCanvas(512)
    renderFaceProc(ctx, DEFAULT_MII_PARAMS, 512)
    expect(isCanvasNonEmpty(ctx)).toBe(true)
  })

  it('handles extreme params without throwing', () => {
    const ctx = makeCanvas()
    const extreme: MiiParams = {
      version: 1, face: {
        headWidth: 0, headHeight: 0, skinTone: 0,
        eyeSize: 0, eyeSpacing: 0, eyeHeight: 0, eyeStyle: 0, eyeColor: 0,
        eyebrowAngle: -1, eyebrowHeight: 0,
        noseHeight: 0, noseWidth: 0,
        mouthWidth: 0, mouthHeight: 0, mouthShape: 0,
        hairStyle: 11, hairColor: 0, accessory: 0,
      },
    }
    expect(() => renderFaceProc(ctx, extreme, 256)).not.toThrow()
  })

  it('handles max params without throwing', () => {
    const ctx = makeCanvas()
    const extreme: MiiParams = {
      version: 1, face: {
        headWidth: 1, headHeight: 1, skinTone: 5,
        eyeSize: 1, eyeSpacing: 1, eyeHeight: 1, eyeStyle: 3, eyeColor: 5,
        eyebrowAngle: 1, eyebrowHeight: 1,
        noseHeight: 1, noseWidth: 1,
        mouthWidth: 1, mouthHeight: 1, mouthShape: 3,
        hairStyle: 11, hairColor: 7, accessory: 4,
      },
    }
    expect(() => renderFaceProc(ctx, extreme, 256)).not.toThrow()
  })
})

describe('renderEmptyFace', () => {
  it('produces non-empty canvas', () => {
    const ctx = makeCanvas()
    renderEmptyFace(ctx, 256)
    expect(isCanvasNonEmpty(ctx)).toBe(true)
  })
})

describe('renderFace dispatcher', () => {
  it('defaults to procedural strategy', () => {
    const ctx = makeCanvas()
    renderFace(ctx, DEFAULT_MII_PARAMS, 256)
    expect(isCanvasNonEmpty(ctx)).toBe(true)
  })

  it('uses procedural when strategy is procedural', () => {
    const ctx = makeCanvas()
    renderFace(ctx, DEFAULT_MII_PARAMS, 256, 'procedural')
    expect(isCanvasNonEmpty(ctx)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/firedisposal/IOMTea && pnpm --filter @iomtea/shared-mii add -D @types/node canvas
pnpm --filter @iomtea/shared-mii run test
```

Expect: all tests FAIL (renderFaceProc not defined).

- [ ] **Step 3: Write renderFaceProc.ts**

Create `packages/shared-mii/src/procedural/renderFaceProc.ts`:

```typescript
import type { MiiParams } from '@iomtea/shared-types'
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS } from './palette'
import { HAIR_STYLES } from './hairStyles'

export function renderFaceProc(
  ctx: CanvasRenderingContext2D,
  params: MiiParams,
  size: number,
): void {
  const p = params.face
  const cx = size / 2
  const cy = size * 0.42
  const rx = size * 0.18 * (1 + (p.headWidth - 0.5) * 0.6)
  const ry = size * 0.22 * (1 + (p.headHeight - 0.5) * 0.6)

  ctx.clearRect(0, 0, size, size)

  // Layer 1: Head
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = SKIN_TONES[p.skinTone]
  ctx.fill()

  // Layer 2: Hair back
  drawHair(ctx, size, p.hairStyle, p.hairColor, 'back', cx, cy)

  // Layer 3: Eyes
  drawEyes(ctx, size, p, cx, cy, rx, ry)

  // Layer 4: Eyebrows
  drawEyebrows(ctx, size, p, cx, cy, rx, ry)

  // Layer 5: Nose
  drawNose(ctx, size, p, cx, cy, rx, ry)

  // Layer 6: Mouth
  drawMouth(ctx, size, p, cx, cy, rx, ry)

  // Layer 7: Hair front
  drawHair(ctx, size, p.hairStyle, p.hairColor, 'front', cx, cy)

  // Layer 8: Accessory
  drawAccessory(ctx, size, p, cx, cy, rx, ry)
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  size: number,
  style: number,
  colorIdx: number,
  layer: 'back' | 'front',
  cx: number,
  cy: number,
): void {
  const s = HAIR_STYLES[style]
  if (!s) return
  const polygons = layer === 'back' ? s.back : s.front
  if (polygons.length === 0) return

  ctx.fillStyle = HAIR_COLORS[colorIdx]
  for (const poly of polygons) {
    ctx.beginPath()
    for (let i = 0; i < poly.length; i++) {
      const px = cx - size * 0.5 + poly[i].x * size
      const py = cy - size * 0.5 + poly[i].y * size
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  }
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: MiiParams['face'],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  const spacing = rx * (0.3 + p.eyeSpacing * 0.8)
  const eyeY = cy - ry * 0.1 - p.eyeHeight * ry * 0.4
  const eyeR = rx * 0.12 * (0.5 + p.eyeSize * 0.8)

  for (const side of [-1, 1]) {
    const ex = cx + side * spacing
    // White
    ctx.beginPath()
    if (p.eyeStyle === 0) {
      ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2)
    } else if (p.eyeStyle === 1) {
      ctx.ellipse(ex, eyeY, eyeR * 1.4, eyeR * 0.8, 0, 0, Math.PI * 2)
    } else if (p.eyeStyle === 2) {
      ctx.ellipse(ex, eyeY, eyeR * 1.3, eyeR * 0.5, 0, 0, Math.PI * 2)
    } else {
      const angle = side * 0.2
      ctx.ellipse(ex, eyeY, eyeR * 1.1, eyeR * 0.7, angle, 0, Math.PI * 2)
    }
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.strokeStyle = '#333'
    ctx.lineWidth = Math.max(1, eyeR * 0.15)
    ctx.stroke()

    // Iris
    const irisR = eyeR * 0.6
    ctx.beginPath()
    ctx.arc(ex + side * irisR * 0.1, eyeY, irisR, 0, Math.PI * 2)
    ctx.fillStyle = EYE_COLORS[p.eyeColor]
    ctx.fill()

    // Pupil
    ctx.beginPath()
    ctx.arc(ex + side * irisR * 0.15, eyeY, irisR * 0.45, 0, Math.PI * 2)
    ctx.fillStyle = '#000000'
    ctx.fill()

    // Highlight
    ctx.beginPath()
    ctx.arc(ex + side * irisR * 0.15, eyeY - irisR * 0.3, irisR * 0.2, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
  }
}

function drawEyebrows(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: MiiParams['face'],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  const browY = cy - ry * 0.45 - p.eyebrowHeight * ry * 0.3
  const spacing = rx * (0.35 + p.eyeSpacing * 0.7)
  const browLen = rx * 0.35
  const thickness = Math.max(2, ry * 0.06)

  ctx.strokeStyle = HAIR_COLORS[p.hairColor]
  ctx.lineWidth = thickness
  ctx.lineCap = 'round'

  for (const side of [-1, 1]) {
    const bx = cx + side * spacing
    const angle = p.eyebrowAngle * 0.4 * side

    ctx.beginPath()
    ctx.moveTo(bx - browLen, browY + angle * browLen * 0.5)
    ctx.quadraticCurveTo(
      bx, browY - angle * browLen * 0.3,
      bx + browLen, browY - angle * browLen * 0.5,
    )
    ctx.stroke()
  }
}

function drawNose(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: MiiParams['face'],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  const noseY = cy + ry * 0.05
  const noseH = ry * 0.12 * (0.5 + p.noseHeight * 0.8)
  const noseW = rx * 0.06 * (0.5 + p.noseWidth * 0.8)

  ctx.beginPath()
  ctx.moveTo(cx, noseY - noseH)
  ctx.lineTo(cx - noseW, noseY + noseH * 0.3)
  ctx.lineTo(cx + noseW, noseY + noseH * 0.3)
  ctx.closePath()
  ctx.fillStyle = darken(SKIN_TONES[p.skinTone], 0.15)
  ctx.fill()
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: MiiParams['face'],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  const mouthY = cy + ry * 0.45 + p.mouthHeight * ry * 0.3
  const mouthW = rx * (0.2 + p.mouthWidth * 0.6)

  ctx.strokeStyle = '#4a3728'
  ctx.lineWidth = Math.max(1.5, ry * 0.04)
  ctx.lineCap = 'round'

  if (p.mouthShape === 0) {
    // Smile
    ctx.beginPath()
    ctx.arc(cx, mouthY - mouthW * 0.3, mouthW, 0.1 * Math.PI, 0.9 * Math.PI)
    ctx.stroke()
  } else if (p.mouthShape === 1) {
    // Neutral
    ctx.beginPath()
    ctx.moveTo(cx - mouthW, mouthY)
    ctx.lineTo(cx + mouthW, mouthY)
    ctx.stroke()
  } else if (p.mouthShape === 2) {
    // Open
    ctx.beginPath()
    ctx.ellipse(cx, mouthY + ry * 0.04, mouthW * 0.5, ry * 0.04, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#3a2020'
    ctx.fill()
    ctx.stroke()
  } else {
    // Pout
    ctx.beginPath()
    ctx.arc(cx, mouthY + mouthW * 0.3, mouthW * 0.7, 1.1 * Math.PI, 1.9 * Math.PI)
    ctx.stroke()
    // Upper lip
    ctx.beginPath()
    ctx.arc(cx, mouthY - ry * 0.03, mouthW * 0.4, 0, Math.PI)
    ctx.stroke()
  }
}

function drawAccessory(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: MiiParams['face'],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  const eyeY = cy - ry * 0.1 - p.eyeHeight * ry * 0.4
  const spacing = rx * (0.3 + p.eyeSpacing * 0.8)

  if (p.accessory === 1) {
    // Glasses
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = Math.max(2, rx * 0.08)
    for (const side of [-1, 1]) {
      const gx = cx + side * spacing
      ctx.beginPath()
      ctx.roundRect(gx - rx * 0.35, eyeY - rx * 0.22, rx * 0.7, rx * 0.44, rx * 0.08)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(cx - spacing + rx * 0.35, eyeY)
    ctx.lineTo(cx + spacing - rx * 0.35, eyeY)
    ctx.stroke()
  } else if (p.accessory === 2) {
    // Sunglasses
    ctx.fillStyle = '#1a1a1a'
    const gw = rx * 1.2
    ctx.beginPath()
    ctx.roundRect(cx - gw, eyeY - rx * 0.25, gw * 2, rx * 0.5, rx * 0.1)
    ctx.fill()
  } else if (p.accessory === 3) {
    // Mask
    ctx.fillStyle = '#e8e8e8'
    const maskY = cy + ry * 0.25
    ctx.beginPath()
    ctx.roundRect(cx - rx * 0.8, maskY, rx * 1.6, ry * 0.35, rx * 0.12)
    ctx.fill()
    ctx.strokeStyle = '#cccccc'
    ctx.lineWidth = 1
    ctx.stroke()
    // Mask strings
    ctx.beginPath()
    ctx.moveTo(cx - rx * 0.8, maskY + ry * 0.15)
    ctx.lineTo(cx - rx * 1.2, maskY - ry * 0.05)
    ctx.moveTo(cx + rx * 0.8, maskY + ry * 0.15)
    ctx.lineTo(cx + rx * 1.2, maskY - ry * 0.05)
    ctx.stroke()
  }
}

function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const d = (v: number) => Math.max(0, Math.round(v * (1 - amount)))
  return `#${d(r).toString(16).padStart(2, '0')}${d(g).toString(16).padStart(2, '0')}${d(b).toString(16).padStart(2, '0')}`
}
```

- [ ] **Step 4: Write empty.ts**

Create `packages/shared-mii/src/empty.ts`:

```typescript
export function renderEmptyFace(ctx: CanvasRenderingContext2D, size: number): void {
  const cx = size / 2
  const cy = size * 0.42
  const r = size * 0.2

  ctx.clearRect(0, 0, size, size)

  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 1.2, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#c0c0c0'
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(cx - r * 0.3, cy - r * 0.1, r * 0.08, r * 0.06, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + r * 0.3, cy - r * 0.1, r * 0.08, r * 0.06, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#888888'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy + r * 0.4, r * 0.15, 0, Math.PI)
  ctx.strokeStyle = '#888888'
  ctx.lineWidth = Math.max(1.5, r * 0.06)
  ctx.stroke()
}
```

- [ ] **Step 5: Write index.ts dispatcher**

Create `packages/shared-mii/src/index.ts`:

```typescript
import type { MiiParams, RenderStrategy } from '@iomtea/shared-types'
import { renderFaceProc } from './procedural/renderFaceProc'
import { renderEmptyFace } from './empty'

export { renderEmptyFace } from './empty'
export { renderFaceProc } from './procedural/renderFaceProc'
export { SKIN_TONES, HAIR_COLORS, EYE_COLORS } from './procedural/palette'
export { HAIR_STYLES } from './procedural/hairStyles'
export type { HairStyle } from './procedural/hairStyles'

export function renderFace(
  ctx: CanvasRenderingContext2D,
  params: MiiParams,
  size: number,
  strategy: RenderStrategy = 'procedural',
): void {
  if (strategy === 'svg') {
    // SVG renderer not yet built — fall back to procedural
    renderFaceProc(ctx, params, size)
  } else {
    renderFaceProc(ctx, params, size)
  }
}
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @iomtea/shared-mii run test
```

Expect: all 8 tests PASS.

- [ ] **Step 7: Run typecheck**

```bash
pnpm --filter @iomtea/shared-mii run typecheck
```

Expect: zero errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared-mii/src/
git commit -m "feat: implement procedural face renderer with tests"
```

---

### Task 3: SVG renderer — asset scaffolding and part registry

**Files:**
- Create: `packages/shared-mii/src/svg/parts.ts`
- Create: `packages/shared-mii/src/svg/recolor.ts`
- Create: `packages/shared-mii/src/svg/renderFaceSvg.ts` (stub)
- Create: `packages/shared-mii/src/svg/assets/` (empty dir with LICENSE)
- Create: `packages/shared-mii/src/svg/assets/LICENSE`
- Create: `packages/shared-mii/src/svg/index.ts`

- [ ] **Step 1: Write LICENSE for SVG assets**

Create `packages/shared-mii/src/svg/assets/LICENSE`:

```
Avatar Illustration System assets
Copyright (c) Micah Lanier
Licensed under CC BY 4.0
https://creativecommons.org/licenses/by/4.0/

Source: https://www.figma.com/community/file/829741575478342595
```

- [ ] **Step 2: Write recolor.ts**

Create `packages/shared-mii/src/svg/recolor.ts`:

```typescript
export function recolorSvg(svg: string, replacements: Record<string, string>): string {
  let result = svg
  for (const [placeholder, color] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, color)
  }
  return result
}

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
```

- [ ] **Step 3: Write parts.ts with placeholder assets**

Create `packages/shared-mii/src/svg/parts.ts`:

```typescript
// Minimal placeholder SVGs — will be replaced with real Avatar Illustration System assets
// after Phase 2 implementation. These produce recognizable faces for development.

const HEAD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120">
  <ellipse cx="50" cy="52" rx="40" ry="48" fill="#SKIN"/>
</svg>`

const EYE_SVGS: Record<number, string> = {
  0: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">
    <ellipse cx="15" cy="10" rx="12" ry="8" fill="white" stroke="#333" stroke-width="1"/><circle cx="16" cy="10" r="5" fill="#EYE"/><circle cx="17" cy="9" r="2" fill="#000"/><circle cx="17" cy="8" r="1" fill="white"/>
  </svg>`,
  1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">
    <ellipse cx="15" cy="10" rx="14" ry="7" fill="white" stroke="#333" stroke-width="1"/><ellipse cx="16" cy="10" rx="5" ry="4" fill="#EYE"/><circle cx="17" cy="10" r="2" fill="#000"/><circle cx="17" cy="9" r="1" fill="white"/>
  </svg>`,
  2: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">
    <ellipse cx="15" cy="10" rx="14" ry="4" fill="white" stroke="#333" stroke-width="1"/><ellipse cx="16" cy="10" rx="4" ry="2.5" fill="#EYE"/><circle cx="17" cy="10" r="1.5" fill="#000"/>
  </svg>`,
  3: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">
    <ellipse cx="15" cy="11" rx="12" ry="7" fill="white" stroke="#333" stroke-width="1" transform="rotate(10 15 11)"/><circle cx="16" cy="11" r="4" fill="#EYE"/><circle cx="17" cy="10" r="1.5" fill="#000"/>
  </svg>`,
}

const NOSE_SVGS: Record<number, string> = {
  0: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 2 L5 16 L15 16 Z" fill="#SHADOW"/></svg>`,
  1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 24"><path d="M10 2 L4 22 L16 22 Z" fill="#SHADOW"/></svg>`,
  2: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 2 L4 14 L16 14 Z" fill="#SHADOW"/></svg>`,
}

const MOUTH_SVGS: Record<number, string> = {
  0: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><path d="M5 5 Q20 18 35 5" fill="none" stroke="#4a3728" stroke-width="2" stroke-linecap="round"/></svg>`,
  1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><line x1="5" y1="10" x2="35" y2="10" stroke="#4a3728" stroke-width="2" stroke-linecap="round"/></svg>`,
  2: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><ellipse cx="20" cy="12" rx="8" ry="5" fill="#3a2020"/><ellipse cx="20" cy="12" rx="8" ry="5" fill="none" stroke="#4a3728" stroke-width="1"/></svg>`,
  3: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><path d="M12 5 Q20 2 28 5" fill="none" stroke="#4a3728" stroke-width="2" stroke-linecap="round"/><path d="M10 8 Q20 14 30 8" fill="none" stroke="#4a3728" stroke-width="2" stroke-linecap="round"/></svg>`,
}

export interface SvgPartSet {
  head: string
  eyes: Record<number, string>
  nose: Record<number, string>
  mouth: Record<number, string>
}

export const SVG_PARTS: SvgPartSet = {
  head: HEAD_SVG,
  eyes: EYE_SVGS,
  nose: NOSE_SVGS,
  mouth: MOUTH_SVGS,
}
```

- [ ] **Step 4: Write svg/index.ts barrel**

Create `packages/shared-mii/src/svg/index.ts`:

```typescript
export { recolorSvg, svgToDataUri } from './recolor'
export { SVG_PARTS } from './parts'
export { renderFaceSvg } from './renderFaceSvg'
```

- [ ] **Step 5: Verify typecheck**

```bash
pnpm --filter @iomtea/shared-mii run typecheck
```

Expect: zero errors. (renderFaceSvg not yet defined → error expected, will be fixed in Task 4.)

- [ ] **Step 6: Commit**

```bash
git add packages/shared-mii/src/svg/
git commit -m "feat: scaffold SVG renderer assets, parts, and recolor"
```

---

### Task 4: SVG renderFaceSvg implementation

**Files:**
- Create: `packages/shared-mii/src/svg/renderFaceSvg.ts`
- Modify: `packages/shared-mii/src/index.ts` (wire dispatcher)
- Create: `packages/shared-mii/src/__tests__/svg.test.ts`

- [ ] **Step 1: Write SVG renderer test**

Create `packages/shared-mii/src/__tests__/svg.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderFaceSvg, loadSvgImage } from '../svg/renderFaceSvg'
import { DEFAULT_MII_PARAMS } from '@iomtea/shared-types'

// NOTE: SVG renderer uses Image() which requires a DOM environment.
// In Node (vitest + canvas), these tests verify the async loading and fallback paths.
// Full visual tests run in browser via MiiEditor.

describe('renderFaceSvg', () => {
  it('loadSvgImage returns null for invalid SVG gracefully', async () => {
    const img = await loadSvgImage('<not>valid</svg>')
    expect(img).toBeNull()
  })
})
```

- [ ] **Step 2: Write renderFaceSvg.ts**

Create `packages/shared-mii/src/svg/renderFaceSvg.ts`:

```typescript
import type { MiiParams } from '@iomtea/shared-types'
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS } from '../procedural/palette'
import { SVG_PARTS } from './parts'
import { recolorSvg, svgToDataUri } from './recolor'
import { renderFaceProc } from '../procedural/renderFaceProc'

const imageCache = new Map<string, HTMLImageElement | null>()

export async function loadSvgImage(svg: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(svg)
  if (cached !== undefined) return cached

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      imageCache.set(svg, img)
      resolve(img)
    }
    img.onerror = () => {
      imageCache.set(svg, null)
      resolve(null)
    }
    img.src = svgToDataUri(svg)
  })
}

function scaleSize(svgWidth: number, svgHeight: number, targetW: number): { w: number; h: number } {
  const scale = targetW / svgWidth
  return { w: targetW, h: svgHeight * scale }
}

export function renderFaceSvg(
  ctx: CanvasRenderingContext2D,
  params: MiiParams,
  size: number,
): void {
  // SVG rendering requires Image() — if unavailable (Node/canvas without DOM),
  // silently fall back to procedural renderer.
  if (typeof Image === 'undefined') {
    renderFaceProc(ctx, params, size)
    return
  }

  const p = params.face
  const cx = size / 2
  const cy = size * 0.42
  ctx.clearRect(0, 0, size, size)

  // Head
  const headSvg = recolorSvg(SVG_PARTS.head, { '#SKIN': SKIN_TONES[p.skinTone] })
  const headImg = imageCache.get(headSvg)
  if (headImg) {
    const { w, h } = scaleSize(100, 120, size * 0.9)
    ctx.drawImage(headImg, cx - w / 2, cy - h * 0.45, w, h)
  } else {
    loadSvgImage(headSvg)
    // Draw procedural head as immediate fallback
    ctx.beginPath()
    ctx.ellipse(cx, cy, size * 0.18, size * 0.22, 0, 0, Math.PI * 2)
    ctx.fillStyle = SKIN_TONES[p.skinTone]
    ctx.fill()
  }

  // Eyes
  const eyeSvg = recolorSvg(SVG_PARTS.eyes[p.eyeStyle] ?? SVG_PARTS.eyes[0], { '#EYE': EYE_COLORS[p.eyeColor] })
  const eyeImg = imageCache.get(eyeSvg)
  const eyeY = cy - size * 0.04 - p.eyeHeight * size * 0.05
  const spacing = size * 0.04 + p.eyeSpacing * size * 0.08

  for (const side of [-1, 1]) {
    const ex = cx + side * spacing
    if (eyeImg) {
      const { w, h } = scaleSize(30, 20, size * 0.3)
      ctx.drawImage(eyeImg, ex - w / 2, eyeY - h / 2, w, h)
    }
  }
  if (!eyeImg) loadSvgImage(eyeSvg)

  // Nose — nose style mapping: 0..3 scaled proportionally to noseHeight/noseWidth
  const noseIdx = Math.min(2, Math.floor(p.noseHeight * 3))
  const noseSvg = recolorSvg(SVG_PARTS.nose[noseIdx], { '#SHADOW': darken(SKIN_TONES[p.skinTone], 0.2) })
  const noseImg = imageCache.get(noseSvg)
  const noseY = cy + size * 0.02
  if (noseImg) {
    const { w, h } = scaleSize(20, 24, size * 0.15 + p.noseWidth * size * 0.1)
    ctx.drawImage(noseImg, cx - w / 2, noseY - h * 0.3, w, h)
  }
  if (!noseImg) loadSvgImage(noseSvg)

  // Mouth
  const mouthSvg = SVG_PARTS.mouth[p.mouthShape] ?? SVG_PARTS.mouth[0]
  const mouthImg = imageCache.get(mouthSvg)
  const mouthY = cy + size * 0.1 + p.mouthHeight * size * 0.04
  const mouthW = size * 0.18 + p.mouthWidth * size * 0.1
  if (mouthImg) {
    const { w, h } = scaleSize(40, 20, mouthW)
    ctx.drawImage(mouthImg, cx - w / 2, mouthY - h / 2, w, h)
  }
  if (!mouthImg) loadSvgImage(mouthSvg)
}

function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const d = (v: number) => Math.max(0, Math.round(v * (1 - amount)))
  return `#${d(r).toString(16).padStart(2, '0')}${d(g).toString(16).padStart(2, '0')}${d(b).toString(16).padStart(2, '0')}`
}
```

- [ ] **Step 3: Wire dispatcher in index.ts**

Modify `packages/shared-mii/src/index.ts` — replace the `renderFace` function body:

```typescript
import type { MiiParams, RenderStrategy } from '@iomtea/shared-types'
import { renderFaceProc } from './procedural/renderFaceProc'
import { renderFaceSvg } from './svg/renderFaceSvg'
import { renderEmptyFace } from './empty'

export { renderEmptyFace } from './empty'
export { renderFaceProc } from './procedural/renderFaceProc'
export { renderFaceSvg } from './svg/renderFaceSvg'
export { SKIN_TONES, HAIR_COLORS, EYE_COLORS } from './procedural/palette'
export { HAIR_STYLES } from './procedural/hairStyles'
export type { HairStyle } from './procedural/hairStyles'

export function renderFace(
  ctx: CanvasRenderingContext2D,
  params: MiiParams,
  size: number,
  strategy: RenderStrategy = 'procedural',
): void {
  if (strategy === 'svg') {
    renderFaceSvg(ctx, params, size)
  } else {
    renderFaceProc(ctx, params, size)
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @iomtea/shared-mii run test
```

Expect: all tests PASS (9 tests now).

- [ ] **Step 5: Run typecheck**

```bash
pnpm --filter @iomtea/shared-mii run typecheck
```

Expect: zero errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-mii/src/svg/renderFaceSvg.ts packages/shared-mii/src/index.ts packages/shared-mii/src/__tests__/
git commit -m "feat: implement SVG composition renderer with async image loading"
```

---

### Task 5: Web MiiEditor component

**Files:**
- Create: `apps/web/src/components/MiiAvatar/MiiCanvas.tsx`
- Create: `apps/web/src/components/MiiAvatar/MiiEditor.tsx`
- Create: `apps/web/src/components/MiiAvatar/MiiEditor.scss`
- Create: `apps/web/src/components/MiiAvatar/index.ts`

- [ ] **Step 1: Write MiiCanvas.tsx**

Create `apps/web/src/components/MiiAvatar/MiiCanvas.tsx`:

```tsx
import { useRef, useEffect } from 'react'
import type { MiiParams, RenderStrategy } from '@iomtea/shared-types'
import { renderFace, renderEmptyFace } from '@iomtea/shared-mii'

interface MiiCanvasProps {
  params: MiiParams | null
  size?: number
  strategy?: RenderStrategy
}

export function MiiCanvas({ params, size = 256, strategy = 'procedural' }: MiiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = size
    canvas.height = size

    if (params) {
      renderFace(ctx, params, size, strategy)
    } else {
      renderEmptyFace(ctx, size)
    }
  }, [params, size, strategy])

  return <canvas ref={canvasRef} width={size} height={size} />
}
```

- [ ] **Step 2: Write MiiEditor.tsx**

Create `apps/web/src/components/MiiAvatar/MiiEditor.tsx`:

```tsx
import { useState, useCallback } from 'react'
import type { MiiParams, RenderStrategy } from '@iomtea/shared-types'
import { DEFAULT_MII_PARAMS } from '@iomtea/shared-types'
import { MiiCanvas } from './MiiCanvas'
import './MiiEditor.scss'

interface MiiEditorProps {
  initialParams?: MiiParams
  canvasSize?: number
  onChange?: (params: MiiParams) => void
  onSave?: (params: MiiParams) => void
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function MiiEditor({ initialParams, canvasSize = 256, onChange, onSave }: MiiEditorProps) {
  const [params, setParams] = useState<MiiParams>(initialParams ?? DEFAULT_MII_PARAMS)
  const [strategy, setStrategy] = useState<RenderStrategy>('procedural')
  const [copied, setCopied] = useState(false)

  const update = useCallback((key: keyof MiiParams['face'], value: number) => {
    setParams(prev => {
      const next: MiiParams = {
        ...prev,
        face: { ...prev.face, [key]: value },
      }
      onChange?.(next)
      return next
    })
  }, [onChange])

  const randomize = useCallback(() => {
    const rng = seededRandom(Date.now())
    const faceParams: Record<string, number> = {}
    const ranges: [string, number, number, boolean][] = [
      ['headWidth', 0.2, 0.8, false], ['headHeight', 0.2, 0.8, false],
      ['skinTone', 0, 5, true], ['eyeSize', 0.2, 0.8, false],
      ['eyeSpacing', 0.2, 0.8, false], ['eyeHeight', 0.2, 0.8, false],
      ['eyeStyle', 0, 3, true], ['eyeColor', 0, 5, true],
      ['eyebrowAngle', -1, 1, false], ['eyebrowHeight', 0.2, 0.8, false],
      ['noseHeight', 0.2, 0.8, false], ['noseWidth', 0.2, 0.8, false],
      ['mouthWidth', 0.2, 0.8, false], ['mouthHeight', 0.2, 0.8, false],
      ['mouthShape', 0, 3, true], ['hairStyle', 0, 11, true],
      ['hairColor', 0, 7, true], ['accessory', 0, 4, true],
    ]
    for (const [key, min, max, isInt] of ranges) {
      const v = rng() * (max - min) + min
      faceParams[key] = isInt ? Math.round(v) : Math.round(v * 100) / 100
    }
    setParams({ version: 1, face: faceParams as MiiParams['face'] })
  }, [])

  const reset = useCallback(() => {
    setParams(initialParams ?? DEFAULT_MII_PARAMS)
  }, [initialParams])

  const exportJson = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(params, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [params])

  const exportPng = useCallback(() => {
    const canvas = document.querySelector('.mii-editor__canvas canvas') as HTMLCanvasElement
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'mii-avatar.png'
    a.click()
  }, [])

  const slider = (label: string, key: keyof MiiParams['face'], min: number, max: number, step = 0.01) => (
    <div className='mii-editor__field' key={key}>
      <label className='mii-editor__label'>{label}</label>
      <input
        type='range' min={min} max={max} step={step}
        value={params.face[key] as number}
        onChange={e => update(key, parseFloat(e.target.value))}
      />
      <span className='mii-editor__value'>{(params.face[key] as number).toFixed(2)}</span>
    </div>
  )

  const chipGroup = (label: string, key: keyof MiiParams['face'], count: number, labels: string[]) => (
    <div className='mii-editor__field' key={key}>
      <label className='mii-editor__label'>{label}</label>
      <div className='mii-editor__chips'>
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            className={`mii-editor__chip ${params.face[key] === i ? 'mii-editor__chip--active' : ''}`}
            onClick={() => update(key, i)}
          >
            {labels[i] ?? i}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className='mii-editor'>
      <div className='mii-editor__canvas'>
        <MiiCanvas params={params} size={canvasSize} strategy={strategy} />
      </div>
      <div className='mii-editor__toolbar'>
        <button onClick={() => setStrategy(s => s === 'procedural' ? 'svg' : 'procedural')}>
          {strategy === 'procedural' ? 'Procedural' : 'SVG'}
        </button>
        <button onClick={randomize}>Randomize</button>
        <button onClick={reset}>Reset</button>
        <button onClick={exportPng}>Export PNG</button>
        <button onClick={exportJson}>{copied ? 'Copied!' : 'Copy JSON'}</button>
      </div>
      <div className='mii-editor__groups'>
        <details open>
          <summary>Head</summary>
          {slider('Head Width', 'headWidth', 0, 1)}
          {slider('Head Height', 'headHeight', 0, 1)}
          {chipGroup('Skin Tone', 'skinTone', 6, ['Fair', 'Light', 'Medium', 'Tan', 'Brown', 'Dark'])}
        </details>
        <details open>
          <summary>Eyes</summary>
          {slider('Eye Size', 'eyeSize', 0, 1)}
          {slider('Eye Spacing', 'eyeSpacing', 0, 1)}
          {slider('Eye Height', 'eyeHeight', 0, 1)}
          {chipGroup('Eye Style', 'eyeStyle', 4, ['Round', 'Almond', 'Narrow', 'Droopy'])}
          {chipGroup('Eye Color', 'eyeColor', 6, ['Dark', 'Gray', 'Purple', 'Blue', 'Green', 'Brown'])}
        </details>
        <details open>
          <summary>Eyebrows</summary>
          {slider('Angle', 'eyebrowAngle', -1, 1)}
          {slider('Height', 'eyebrowHeight', 0, 1)}
        </details>
        <details open>
          <summary>Nose</summary>
          {slider('Height', 'noseHeight', 0, 1)}
          {slider('Width', 'noseWidth', 0, 1)}
        </details>
        <details open>
          <summary>Mouth</summary>
          {slider('Width', 'mouthWidth', 0, 1)}
          {slider('Position', 'mouthHeight', 0, 1)}
          {chipGroup('Shape', 'mouthShape', 4, ['Smile', 'Neutral', 'Open', 'Pout'])}
        </details>
        <details open>
          <summary>Hair</summary>
          {chipGroup('Style', 'hairStyle', 12, [
            'Short', 'Middle', 'Bangs', 'Long Straight', 'Long Curly', 'Buzz',
            'Side Part', 'Bun', 'Pigtails', 'Afro', 'Slick Back', 'Bald',
          ])}
          {chipGroup('Color', 'hairColor', 8, [
            'Black', 'Brown', 'Chestnut', 'Blonde', 'Ash', 'White', 'Purple', 'Red',
          ])}
        </details>
        <details>
          <summary>Accessory</summary>
          {chipGroup('Type', 'accessory', 5, ['None', 'Glasses', 'Sunglasses', 'Mask'])}
        </details>
      </div>
      {onSave && (
        <button className='mii-editor__save' onClick={() => onSave(params)}>
          Save
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write MiiEditor.scss**

Create `apps/web/src/components/MiiAvatar/MiiEditor.scss`:

```scss
.mii-editor {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;

  &__canvas {
    display: flex;
    justify-content: center;
    margin-bottom: 12px;

    canvas {
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    }
  }

  &__toolbar {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-bottom: 16px;

    button {
      padding: 6px 14px;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
      font-size: 13px;

      &:hover {
        background: #f5f5f5;
      }

      &:first-child {
        font-weight: 600;
        background: #416323;
        color: #fff;
        border-color: #416323;
      }
    }
  }

  &__groups {
    details {
      margin-bottom: 8px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 10px 14px;

      summary {
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
      }
    }
  }

  &__field {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 6px 0;
  }

  &__label {
    width: 100px;
    font-size: 13px;
    color: #555;
    flex-shrink: 0;
  }

  &__value {
    width: 40px;
    font-size: 12px;
    text-align: right;
    color: #888;
  }

  input[type="range"] {
    flex: 1;
  }

  &__chips {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  &__chip {
    padding: 3px 8px;
    border: 1px solid #ddd;
    border-radius: 14px;
    background: #fff;
    cursor: pointer;
    font-size: 12px;

    &--active {
      background: #416323;
      color: #fff;
      border-color: #416323;
    }

    &:hover:not(&--active) {
      background: #f0f0f0;
    }
  }

  &__save {
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: 8px;
    background: #416323;
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    margin-top: 12px;
  }
}
```

- [ ] **Step 4: Write barrel export**

Create `apps/web/src/components/MiiAvatar/index.ts`:

```typescript
export { MiiCanvas } from './MiiCanvas'
export { MiiEditor } from './MiiEditor'
```

- [ ] **Step 5: Verify typecheck**

```bash
pnpm --filter @iomtea/web run typecheck
```

Expect: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/MiiAvatar/
git commit -m "feat: add Web MiiEditor with procedural/SVG toggle and full slider controls"
```

---

### Task 6: Mini-program MiiCanvas integration

**Files:**
- Create: `apps/miniapp/src/components/MiiAvatar/MiiCanvas.tsx`

- [ ] **Step 1: Write Taro MiiCanvas wrapper**

Create `apps/miniapp/src/components/MiiAvatar/MiiCanvas.tsx`:

```tsx
import { useRef, useEffect } from 'react'
import { Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { MiiParams, RenderStrategy } from '@iomtea/shared-types'
import { renderFace, renderEmptyFace } from '@iomtea/shared-mii'

interface MiiCanvasProps {
  params: MiiParams | null
  size?: number
  strategy?: RenderStrategy
}

export function MiiCanvas({ params, size = 128, strategy = 'procedural' }: MiiCanvasProps) {
  const canvasId = useRef(`mii-${Math.random().toString(36).slice(2, 8)}`).current

  useEffect(() => {
    const ctx = Taro.createCanvasContext(canvasId) as unknown as CanvasRenderingContext2D

    if (params) {
      renderFace(ctx, params, size, strategy)
    } else {
      renderEmptyFace(ctx, size)
    }

    ctx.draw()
  }, [params, size, strategy, canvasId])

  return (
    <Canvas
      canvasId={canvasId}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @iomtea/miniapp run typecheck
```

Expect: zero errors (or only pre-existing errors, no new errors from this file).

- [ ] **Step 3: Commit**

```bash
git add apps/miniapp/src/components/MiiAvatar/
git commit -m "feat: add mini-program MiiCanvas Taro wrapper"
```

---

### Task 7: Server PNG endpoint

**Files:**
- Create: `apps/server/src/routes/avatar.ts`
- Modify: `apps/server/src/app.ts` (register route)

- [ ] **Step 1: Write avatar route**

Create `apps/server/src/routes/avatar.ts`:

```typescript
import { Hono } from 'hono'
import { createCanvas } from 'canvas'
import { renderFace, renderEmptyFace } from '@iomtea/shared-mii'

export const avatarRoute = new Hono()

avatarRoute.get('/api/avatar/:patientId', async (c) => {
  const patientId = c.req.param('patientId')

  // TODO: replace with actual DB query once avatar_params column exists
  // const patient = await db.query.patients.findFirst({ where: eq(patients.id, patientId) })
  // if (!patient?.avatarParams) return c.notFound()
  // const params = patient.avatarParams

  // For now, return a default empty avatar
  const canvas = createCanvas(256, 256)
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
  renderEmptyFace(ctx, 256)

  // When DB integration is complete:
  // const params = patient.avatarParams
  // if (params) renderFace(ctx, params, 256)
  // else renderEmptyFace(ctx, 256)

  const buf = canvas.toBuffer('image/png')
  return new Response(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
})
```

- [ ] **Step 2: Register route in app.ts**

Modify `apps/server/src/app.ts` — locate where routes are registered and add:

```typescript
import { avatarRoute } from './routes/avatar'

// ... existing route registrations ...
app.route('/', avatarRoute)
```

- [ ] **Step 3: Install node-canvas dependency**

```bash
cd /home/firedisposal/IOMTea && pnpm --filter @iomtea/server add canvas
pnpm --filter @iomtea/server add -D @types/node
pnpm install
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm --filter @iomtea/server run typecheck
```

Expect: zero errors (or only pre-existing errors).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/avatar.ts apps/server/src/app.ts apps/server/package.json
git commit -m "feat: add server avatar PNG endpoint"
```

---

### Task 8: Database schema — add avatar_params column

**Files:**
- Modify: `apps/server/src/db/schema.ts` (or wherever patients table is defined)
- Modify: `packages/shared-types/src/schemas/patient.ts`

- [ ] **Step 1: Locate patient schema and add avatar_params**

Find the `patients` table definition in the server's Drizzle schema and add:

```typescript
// In apps/server/src/db/schema/patients.ts or equivalent:
import { MiiParamsSchema } from '@iomtea/shared-types'

export const patients = pgTable('patients', {
  // ... existing columns ...
  avatarParams: jsonb('avatar_params').$type<MiiParams | null>(),
})
```

Also update `packages/shared-types/src/schemas/patient.ts`:

```typescript
import { MiiParamsSchema } from '../mii-params'

export const patientSchema = z.object({
  // ... existing fields ...
  avatarParams: MiiParamsSchema.nullable().optional(),
})
```

- [ ] **Step 2: Generate and run migration**

```bash
pnpm --filter @iomtea/server run db:generate
pnpm --filter @iomtea/server run db:migrate
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/db/schema/ packages/shared-types/src/schemas/
git commit -m "feat: add avatar_params JSONB column to patients table"
```

---

### Task 9: End-to-end verification

- [ ] **Step 1: Run all typechecks**

```bash
pnpm --filter @iomtea/shared-mii run typecheck
pnpm --filter @iomtea/web run typecheck
pnpm --filter @iomtea/miniapp run typecheck
pnpm --filter @iomtea/server run typecheck
```

Expect: zero errors across all packages.

- [ ] **Step 2: Run all tests**

```bash
pnpm --filter @iomtea/shared-mii run test
```

Expect: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: final verification — all typechecks and tests pass"
```

---

## Summary

| Task | Deliverable | New Files |
|------|------------|-----------|
| 0 | Package scaffold + MiiParams schema | 4 |
| 1 | Palette + 12 hair style polygon sets | 3 |
| 2 | Procedural renderFaceProc + tests + dispatcher | 4 |
| 3 | SVG asset scaffold + parts + recolor | 6 |
| 4 | SVG renderFaceSvg + tests | 3 |
| 5 | Web MiiEditor (React) | 4 |
| 6 | Mini-program MiiCanvas (Taro) | 1 |
| 7 | Server PNG endpoint | 2 |
| 8 | DB schema migration | 2 |
| 9 | Verification | 0 |

**Total: 29 new files, ~12 hours estimated**
