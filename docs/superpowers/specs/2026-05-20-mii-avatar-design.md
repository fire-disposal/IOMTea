# Mii-like Avatar System Design

**Date:** 2026-05-20
**Status:** Draft
**Scope:** Web + Mini-Program + Server

---

## Overview

引入类 Nintendo Mii 的参数化头像系统，用于捏脸和指代用户。**平等支持两种渲染策略**：程序化 Canvas 2D 几何绘制 与 SVG 面部零件合成。两者共享同一参数 Schema 和接口，消费者无感知切换。

### Dual Renderer Strategy

| 策略 | 实现方式 | 优势 | 劣势 |
|------|----------|------|------|
| **Procedural** | Canvas 2D `arc`/`ellipse`/`bezierCurve` 纯几何 | 无限可调参数、零外部资产、极致体积 (~15KB) | 质量依赖代码精度，可能不够精致 |
| **SVG Compose** | CC BY 4.0 SVG 零件 (`drawImage`) 合成 | 美术级别质量、经过 3.8k+ star 验证 | 依赖外部资产文件 (~50-80KB)、零件变体有限 |

**两者并行构建，可运行时/构建时切换**。编辑器默认两种都可用，最终产物由平台需求选择（小程序可能偏好 Procedural 以节省体积，Web 可能偏好 SVG 以获得更好视觉效果）。

### SVG Asset Source

采用 [Avatar Illustration System](https://www.figma.com/community/file/829741575478342595) by Micah Lanier (CC BY 4.0)，该资产系统已被以下开源项目验证：
- [vue-color-avatar](https://github.com/Codennnn/vue-color-avatar) (3.8k stars, MIT)
- [react-nice-avatar](https://github.com/dapi-labs/react-nice-avatar) (1.3k stars, MIT)

CC BY 4.0 要求署名 `Micah Lanier`，可商用、可修改、可再分发。

### Goals

- 统一患者/用户在系统中的视觉身份
- 两种渲染策略平等支持，接口一致（`renderFace(ctx, params, size)`）
- 参数化存储（~300B JSON），零二进制资产（SVG 嵌入代码或独立文件均可）
- Web、小程序、Server 三端均可选择最优策略
- 支持未来 3D 升级：2D 脸部可贴图到低多边形身体模型

### Non-Goals

- 本次不做 3D 渲染（Three.js 升级推迟到未来 Phase）
- 不做全身动画
- 不做实时表情驱动

---

## System Architecture

```
                    ┌─── MiiParams (JSON, ~300B) ───┐
                    │                               │
            ┌───────┴──────────┐          ┌─────────┴──────────┐
            │ Procedural       │          │ SVG Compose        │
            │ renderFaceProc() │          │ renderFaceSvg()    │
            │ arc/ellipse/     │          │ ctx.drawImage()    │
            │ bezierCurve      │          │ + SVG sprite parts │
            └───────┬──────────┘          └─────────┬──────────┘
                    │                               │
                    └───────────┬───────────────────┘
                                │
                     renderFace(ctx, params, size, strategy?)
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
        Web (DOM)         Mini-Program           Server
        ┌───────┐         ┌──────────┐          ┌──────────┐
        │Canvas │         │Taro      │          │node-     │
        │Element│         │<Canvas>  │          │canvas    │
        └──┬────┘         └────┬─────┘          └────┬─────┘
           │                   │                      │
        MiiEditor          MiiAvatar              PNG endpoint
        ┌──────────┐      ┌──────────┐          ┌──────────┐
        │Sliders   │      │Patient   │          │GET /api/ │
        │Strategy   │      │Card      │          │avatar/:id│
        │Toggle    │      │TabBar    │          │          │
        │Export    │      │          │          │          │
        └──────────┘      └──────────┘          └──────────┘
```

### File Structure

```
packages/shared-types/src/
  └── mii-params.ts          # MiiParams type + Zod schema

packages/shared-mii/
  ├── package.json           # @iomtea/shared-mii, workspace:*
  ├── index.ts               # renderFace() dispatcher + re-exports
  ├── procedural/
  │   ├── renderFaceProc.ts  # Core procedural 2D rendering
  │   ├── palette.ts         # Skin/hair/eye color palettes
  │   └── hairStyles.ts      # 12 pre-defined hair polygon sets
  ├── svg/
  │   ├── renderFaceSvg.ts   # SVG composition renderer
  │   ├── assets/            # SVG part files (from Avatar Illustration System)
  │   │   ├── face/          # Face shape SVGs
  │   │   ├── eyes/          # Eye style SVGs
  │   │   ├── nose/          # Nose style SVGs
  │   │   ├── mouth/         # Mouth shape SVGs
  │   │   ├── hair/          # Hair style SVGs
  │   │   ├── eyebrow/       # Eyebrow style SVGs
  │   │   ├── glasses/       # Accessory SVGs
  │   │   └── LICENSE        # CC BY 4.0 attribution
  │   ├── parts.ts           # Part registry: maps style enum → SVG paths
  │   └── recolor.ts         # SVG color replacement utility
  └── empty.ts               # renderEmptyFace() fallback

apps/web/src/components/
  └── MiiAvatar/
      ├── MiiCanvas.tsx      # React <canvas> wrapper
      ├── MiiEditor.tsx      # Full editor UI (sliders + strategy toggle + preview)
      └── MiiEditor.scss

apps/miniapp/src/components/
  └── MiiAvatar/
      └── MiiCanvas.tsx      # Taro <Canvas> wrapper

apps/server/src/
  └── routes/
      └── avatar.ts          # GET /api/avatar/:patientId → PNG
```


---

## Parameter Schema

```typescript
// packages/shared-types/src/mii-params.ts

export const MiiParamsSchema = z.object({
  version: z.literal(1),
  face: z.object({
    headWidth:     z.number().min(0).max(1),    // 头宽系数
    headHeight:    z.number().min(0).max(1),    // 头高系数
    skinTone:      z.number().int().min(0).max(5), // 肤色
    eyeSize:       z.number().min(0).max(1),    // 眼睛大小
    eyeSpacing:    z.number().min(0).max(1),    // 眼间距
    eyeHeight:     z.number().min(0).max(1),    // 眼睛高度
    eyeStyle:      z.number().int().min(0).max(3), // 眼型
    eyeColor:      z.number().int().min(0).max(5), // 虹膜色
    eyebrowAngle:  z.number().min(-1).max(1),   // 眉毛旋转
    eyebrowHeight: z.number().min(0).max(1),    // 眉毛高度
    noseHeight:    z.number().min(0).max(1),    // 鼻子长度
    noseWidth:     z.number().min(0).max(1),    // 鼻子宽度
    mouthWidth:    z.number().min(0).max(1),    // 嘴巴宽度
    mouthHeight:   z.number().min(0).max(1),    // 嘴巴位置
    mouthShape:    z.number().int().min(0).max(3), // 嘴型
    hairStyle:     z.number().int().min(0).max(11), // 发型
    hairColor:     z.number().int().min(0).max(7),  // 发色
    accessory:     z.number().int().min(0).max(4),  // 配件
  }),
  seed: z.number().int().optional(),              // 确定性种子
})

export type MiiParams = z.infer<typeof MiiParamsSchema>
```

Total JSON size: ~300 bytes. For 10,000 patients: ~3MB storage.

### Default / Random Generation

```typescript
export function randomMiiParams(seed?: number): MiiParams {
  const rng = seedRandom(seed ?? Date.now())
  return {
    version: 1,
    face: {
      headWidth:     rng(0.3, 0.7),
      headHeight:    rng(0.3, 0.7),
      skinTone:      rng.int(0, 5),
      eyeSize:       rng(0.3, 0.7),
      eyeSpacing:    rng(0.3, 0.7),
      eyeHeight:     rng(0.3, 0.7),
      eyeStyle:      rng.int(0, 3),
      eyeColor:      rng.int(0, 5),
      eyebrowAngle:  rng(-1, 1),
      eyebrowHeight: rng(0.2, 0.8),
      noseHeight:    rng(0.3, 0.7),
      noseWidth:     rng(0.3, 0.7),
      mouthWidth:    rng(0.3, 0.7),
      mouthHeight:   rng(0.3, 0.7),
      mouthShape:    rng.int(0, 3),
      hairStyle:     rng.int(0, 11),
      hairColor:     rng.int(0, 7),
      accessory:     rng.int(0, 4),
    },
    seed,
  }
}
```

Future: seed generation from patient demographics (gender biases hair styles, age biases skin tone, etc.).

---

## Rendering Strategy A: Procedural Canvas 2D

### Layer Order (bottom → top)

| Layer | Function | Method |
|-------|----------|--------|
| 1. Head base | `drawHead(ctx, p)` | `ctx.ellipse()` + skin tone fill |
| 2. Hair back | `drawHairLayer(ctx, p, 'back')` | Pre-defined path polygons |
| 3. Eyes | `drawEyes(ctx, p)` | Dual ellipses (white + iris + pupil + highlight) |
| 4. Eyebrows | `drawEyebrows(ctx, p)` | `ctx.lineTo` with variable thickness + rotation |
| 5. Nose | `drawNose(ctx, p)` | Triangle or curve shadow |
| 6. Mouth | `drawMouth(ctx, p)` | `ctx.arc` / `ctx.bezierCurve` mapped to mouthShape |
| 7. Hair front | `drawHairLayer(ctx, p, 'front')` | Pre-defined path polygons |
| 8. Accessory | `drawAccessory(ctx, p)` | Glasses/mask overlay |

### Coordinate System

All positions calculated relative to `size` (square canvas, typically 256 or 512):

```
(0,0) ──────────────────── (size, 0)
  │                          │
  │     Head ellipse at      │
  │     (size/2, size*0.45)  │
  │     with radii based     │
  │     on headWidth/Height  │
  │                          │
(0,size) ────────────── (size, size)
```

Base head center: `(cx, cy) = (size/2, size * 0.42)`
Base head radii: `(rx, ry) = (size * 0.18 * (1 + headWidth*0.3), size * 0.22 * (1 + headHeight*0.3))`

### Eye Rendering Detail

Four eye styles via parameter `eyeStyle`:
- **0 - Round**: Full circle iris, large pupil
- **1 - Almond**: Overlapped ellipses forming almond shape, medium iris
- **2 - Narrow**: Thin horizontal ellipse, small iris
- **3 - Droopy**: Outer corners lower, drawn as angled ellipse

Each eye:
1. White background (`fillStyle: '#FFF'`)
2. Iris colored circle (`fillStyle: eyeColors[eyeColor]`)
3. Pupil black circle (`fillStyle: '#000'`)
4. Highlight white dot (`fillStyle: '#FFF'`, `arc` at top-right of iris)

### Mouth Rendering Detail

Four mouth shapes via `mouthShape`:
- **0 - Smile**: Upward `arc(0, Math.PI)` with `counterclockwise: true`
- **1 - Neutral**: Straight horizontal line (`moveTo` → `lineTo`)
- **2 - Open**: Ellipse (`ellipse` with small ry, filled dark)
- **3 - Pout**: Small downward arc + upper lip curve

### Hair Style System

12 styles, each a pair of polygon arrays in normalized 0..1 space:

```typescript
interface HairStyle {
  name: string
  back: Vector2[][]   // polygons rendered behind face
  front: Vector2[][]  // polygons rendered in front
}

const HAIR_STYLES: HairStyle[] = [
  { name: '短发',   back: [[...]], front: [[...]] },
  { name: '中分',   back: [[...]], front: [[...]] },
  { name: '刘海',   back: [[...]], front: [[...]] },
  { name: '长发直',  back: [[...]], front: [[...]] },
  { name: '长发卷',  back: [[...]], front: [[...]] },
  { name: '寸头',   back: [[...]], front: [[...]] },
  { name: '偏分',   back: [[...]], front: [[...]] },
  { name: '丸子头',  back: [[...]], front: [[...]] },
  { name: '双马尾',  back: [[...]], front: [[...]] },
  { name: '蓬松',   back: [[...]], front: [[...]] },
  { name: '背头',   back: [[...]], front: [[...]] },
  { name: '光头',   back: [],       front: []       },
]
```

Normalized coordinates (0..1 in unit square) → scaled by `size` at render time. Each style ~10-30 vertices per polygon × 2-3 polygons = ~200 float points per style. Total 12 styles: ~2,400 data points = ~20KB source.

---

## Rendering Strategy B: SVG Composition

### Approach

Replace per-feature procedural drawing with `ctx.drawImage()` of pre-designed SVG parts. Each parameter value maps to an SVG file from the Avatar Illustration System asset set. Color is applied at render time via SVG string replacement or `ctx.globalCompositeOperation`.

### Part Registry

```typescript
// packages/shared-mii/src/svg/parts.ts

interface SvgPart {
  id: string          // e.g. 'eyes-round', 'hair-mohawk'
  svg: string         // inline SVG markup
  defaultColor?: string  // hex, replaced at render time
}

const EYE_PARTS: Record<number, SvgPart> = {
  0: { id: 'eyes-circle',  svg: '<svg>...</svg>', defaultColor: '#000' },
  1: { id: 'eyes-oval',    svg: '<svg>...</svg>', defaultColor: '#000' },
  2: { id: 'eyes-narrow',  svg: '<svg>...</svg>', defaultColor: '#000' },
  3: { id: 'eyes-droopy',  svg: '<svg>...</svg>', defaultColor: '#000' },
}

const NOSE_PARTS: Record<number, SvgPart> = {
  0: { id: 'nose-short', svg: '<svg>...</svg>' },
  1: { id: 'nose-long',  svg: '<svg>...</svg>' },
  2: { id: 'nose-round', svg: '<svg>...</svg>' },
}
```

### Render Pipeline

```
renderFaceSvg(ctx, params, size):
  1. Load SVG parts: face, eyes[eyeStyle], nose[noseStyle],
     mouth[mouthShape], hair[hairStyle], accessory[accessory]
  2. For each part:
     a. Apply color (replace placeholder color in SVG string)
     b. Convert SVG string → Image (via data: URI or preloaded Image cache)
     c. ctx.drawImage(img, scaled position from params)
  3. Layer order identical to Procedural strategy
```

### Color Application

SVG parts use a placeholder color (`#REPLACE`) that gets string-replaced before rendering:

```typescript
function recolorSvg(svg: string, color: string): string {
  return svg.replace(/#REPLACE/g, color)
}
```

For parts that need multiple colors (e.g., skin + clothes), use indexed placeholders: `#COLOR0`, `#COLOR1`.

### SVG Asset Size

Per part: 1-3KB (minified inline SVG). All 40+ parts combined: ~50-80KB (before gzip). Comparable to a single medium-size JPEG. Well within all platform constraints.

### Preloading Strategy

SVG parts are converted to `Image` objects on first use and cached in a `Map<string, HTMLImageElement>`. Subsequent renders hit zero I/O.

---

### Color Palettes (shared by both strategies)

```typescript
export const SKIN_TONES = [
  '#FDEBD0', '#F5CBA7', '#E8B88A', '#D4A373', '#C68642', '#8D5524'
]
export const HAIR_COLORS = [
  '#1A1A2E', '#3D2B1F', '#6B4226', '#B8860B', '#D4A574', '#E6C3A5', '#7B68EE', '#C0392B'
]
export const EYE_COLORS = [
  '#2C3E50', '#5D6D7E', '#7D3C98', '#1A5276', '#117A65', '#935116'
]
```

### Fallback: `renderEmptyFace(ctx, size)`

When no params available, render a generic silhouette (gray ellipse + question mark or simple anonymous face). Same function for both strategies.

---

## Web: MiiEditor (v0.1)

### Layout

```
┌──────────────────────────────────────┐
│   Preview Canvas (512×512)           │
│   ┌──────────────────────────────┐   │
│   │          Live Render         │   │
│   │                              │   │
│   └──────────────────────────────┘   │
│   [Procedural|SVG] [Randomize] [Reset] [Export] │
├──────────────────────────────────────┤
│  Slider Group: Head                  │
│  headWidth    ───────●────── 0.52    │
│  headHeight   ───●────────── 0.38    │
│  skinTone     [■][■][●][ ][ ][ ]     │
├──────────────────────────────────────┤
│  Slider Group: Eyes                  │
│  eyeSize      ──────●─────── 0.61    │
│  eyeSpacing   ────●───────── 0.45    │
│  eyeHeight    ─────●──────── 0.50    │
│  eyeStyle     [●][ ][ ][ ]           │
│  eyeColor     [ ][●][ ][ ][ ][ ]     │
├──────────────────────────────────────┤
│  ... Mouth, Nose, Hair, Accessory    │
└──────────────────────────────────────┘
```

### Component API

```typescript
interface MiiEditorProps {
  initialParams?: MiiParams
  canvasSize?: number      // default 512
  strategy?: RenderStrategy  // default 'procedural'
  onChange?: (params: MiiParams) => void
  onSave?: (params: MiiParams) => void
}
```

Params updated in real-time via `useState` + `useCallback`. Canvas re-renders via `useEffect` on `miiParams` change (debounced to 16ms for 60fps). Strategy toggle switches between procedural and SVG renderers live, allowing A/B comparison.

### Randomize

Seeded RNG for reproducibility. "Randomize" generates new random values for all sliders. "Reset" reverts to `initialParams`.

### Export

`canvas.toDataURL('image/png')` → trigger download or copy to clipboard.

### Future: Patient Integration

When embedded in PatientProfile page:
- `initialParams` loaded from `patient.avatar_params`
- `onSave` calls `trpc.patient.updateAvatar.mutate({ patientId, params })`
- Preview shown on PatientCard replacing initials avatar

---

## Mini-Program Integration

### Taro Canvas Component

```tsx
// apps/miniapp/src/components/MiiAvatar/MiiCanvas.tsx
import { Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { renderFace } from './renderFace'
import type { MiiParams } from '@iomtea/shared-types'

interface Props {
  params: MiiParams | null
  size?: number  // default 128 (smaller for mobile)
}

export function MiiCanvas({ params, size = 128 }: Props) {
  const canvasId = useRef(`mii-${Date.now()}`).current

  useEffect(() => {
    const ctx = Taro.createCanvasContext(canvasId)
    if (params) {
      renderFace(ctx as any, params, size)
    } else {
      renderEmptyFace(ctx as any, size)
    }
    ctx.draw()
  }, [params, size])

  return <Canvas canvasId={canvasId} style={{ width: size, height: size }} />
}
```

### Integration Points

| Page | Location | Usage |
|------|----------|-------|
| Profile | Top section | User's own avatar (editable in future) |
| PatientCard | Avatar slot | Replace NutUI Avatar initials |
| Home (index) | TopBar | Small avatar icon |
| Patient list | List items | Thumbnail avatars |

### Bundle Size

`renderFace` + `palette` + `hairStyles` ≈ 30KB minified. Well within WeChat mini-program's 2MB limit.

---

## Server: PNG Fallback

```typescript
// apps/server/src/routes/avatar.ts
import { createCanvas } from 'canvas' // node-canvas
import { renderFace } from '@iomtea/shared-mii'

app.get('/api/avatar/:patientId', async (c) => {
  const patient = await db.patients.findById(c.req.param('patientId'))
  if (!patient?.avatar_params) return c.notFound()

  const canvas = createCanvas(256, 256)
  const ctx = canvas.getContext('2d')
  renderFace(ctx, patient.avatar_params, 256)

  const buf = canvas.toBuffer('image/png')
  return new Response(buf, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }
  })
})
```

Use cases: push notification thumbnails, email reports, mini-program fallback (if Canvas unavailable), third-party integration.

---

## Database Schema

```sql
ALTER TABLE patients ADD COLUMN avatar_params JSONB;
```

Data type: `MiiParams` JSON blob. Default: `NULL` (triggers `renderEmptyFace`).

No migration needed for existing patients — `NULL` avatar_params renders the default silhouette.

Add to shared schema:

```typescript
// packages/shared-types/src/schemas/patient.ts
export const patientSchema = z.object({
  // ... existing fields
  avatarParams: MiiParamsSchema.nullable().optional(),
})
```

---

## Editor as Debug Tool

The Web MiiEditor serves double duty:
1. **User-facing**: Patient creating their avatar
2. **Developer-facing**: Parameter tweaking with live preview, parameter export/import, visual regression testing

Debug features:
- JSON export: Copy params to clipboard
- URL sharing: Encode params as base64 in URL hash for sharing
- Diff view: Compare two param sets side by side
- Animation test: Cycle through random params to visually verify all combos render correctly

---

## Phase Plan

| Phase | Deliverables | Effort |
|-------|-------------|--------|
| **Phase 0** (done) | Parameter schema + Zod + shared types | - |
| **Phase 1** | `shared-mii` package: procedural `renderFaceProc` + palettes + hair styles | 2-3 days |
| **Phase 2** | `shared-mii` SVG: `renderFaceSvg` + SVG asset imports + part registry + recolor | 2-3 days |
| **Phase 3** | `MiiEditor.tsx` (Web) with strategy toggle + debug tools | 2-3 days |
| **Phase 4** | Mini-program `MiiCanvas` + profile/profile-card integration | 1-2 days |
| **Phase 5** | Server PNG endpoint + DB schema + patient integration | 1 day |
| **Future** | 3D face on Three.js body, posture animation | 3-5 days |

Phase 1 (Procedural) and Phase 2 (SVG) are **parallel peers** — built sequentially but with equal status. The strategy toggle in MiiEditor allows immediate A/B comparison.

---

## Future: 3D Upgrade Path

The 2D face rendered by `renderFace` can be captured via `canvas.toDataURL()` and applied as a texture to a Three.js low-poly head mesh. The head mesh uses `SphereGeometry` deformed by the same `headWidth`/`headHeight` parameters. Body mesh driven by patient `height`/`weight` demographics. This is a Phase 5+ item and not in current scope.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WeChat Canvas 2D API differences | Use only standard `arc`, `ellipse`, `fill`, `stroke`, `fillStyle`, `beginPath`; test on real device |
| `ellipse()` not supported in old WeChat | Polyfill with 4× `bezierCurveTo` approximation |
| WeChat `drawImage` with data: URI / SVG fails | Pre-render SVG parts to offscreen Canvas on first load; use PNG fallback sprites |
| SVG part loading latency | Inline all SVG as string constants in `parts.ts`; zero network I/O |
| Hair styles too crude (procedural) | 12 well-designed hand-authored polygon styles; SVG strategy provides artist-quality fallback |
| SVG parts don't cover all parameter combos | Map enum values to closest SVG part; procedural strategy fills gaps with full coverage |
| Editor slider fatigue (18 params) | Randomize button + "Quick Styles" presets + demographic-seeded defaults |
| CC BY 4.0 license compliance | Attribution text in app footer; LICENSE file in SVG asset directory; documented in README |

---

## Acceptance Criteria

1. `renderFace(ctx, params, 512, 'procedural')` produces a recognizable face for any valid params
2. `renderFace(ctx, params, 512, 'svg')` produces a face with artist-quality features (using CC BY 4.0 assets)
3. Both strategies produce identical parametric interpretation (same params → same visual intent)
4. `renderFace(ctx, params, 128)` renders correctly at small sizes (mini-program)
5. `MiiEditor` responds to slider changes with <50ms render delay for both strategies
6. Strategy toggle switches renderers without losing slider state
7. Randomize produces visually distinct faces ≥80% of the time
8. Same params → identical output on Web, Mini-Program, and Server
9. Empty params → renders generic silhouette
10. TypeScript: zero errors across all packages
11. Mini-program bundle increase: <50KB (procedural), <100KB (with SVG)
12. SVG assets include CC BY 4.0 attribution visible in app credits
