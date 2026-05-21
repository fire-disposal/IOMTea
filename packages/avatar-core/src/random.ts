import { DEFAULT_AVATAR_SPEC, type AvatarSpec } from '@iomtea/shared-types'

const hashSeed = (seed: string | number) => {
  const text = String(seed)
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const mulberry32 = (seed: number) => {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(arr: readonly T[], rand: () => number): T => arr[Math.floor(rand() * arr.length)]
const range = (min: number, max: number, rand: () => number) => min + rand() * (max - min)
const int = (min: number, max: number, rand: () => number) => Math.floor(range(min, max + 1, rand))

export function randomAvatarSpec(seed: string | number = Date.now()): AvatarSpec {
  const rand = mulberry32(hashSeed(seed))

  return {
    ...DEFAULT_AVATAR_SPEC,
    seed: typeof seed === 'number' ? seed : hashSeed(seed),
    face: {
      shape: pick(['round', 'oval', 'square'] as const, rand),
      skinTone: int(0, 5, rand),
      headScale: range(0.8, 1.2, rand),
      jawRoundness: range(0, 1, rand),
    },
    eyes: {
      style: pick(['round', 'almond', 'smile'] as const, rand),
      size: range(0.6, 1.4, rand),
      spacing: range(0.6, 1.5, rand),
      height: range(0.3, 0.7, rand),
      color: int(0, 5, rand),
    },
    brows: {
      style: pick(['soft', 'flat', 'sharp'] as const, rand),
      angle: range(-1, 1, rand),
      thickness: range(0.6, 1.5, rand),
    },
    nose: {
      style: pick(['dot', 'small', 'long'] as const, rand),
      width: range(0.6, 1.4, rand),
      height: range(0.6, 1.4, rand),
    },
    mouth: {
      style: pick(['smile', 'neutral', 'laugh'] as const, rand),
      width: range(0.6, 1.4, rand),
      openness: range(0, 1, rand),
    },
    hair: {
      style: pick(['short', 'long', 'buzz', 'curly'] as const, rand),
      color: int(0, 7, rand),
    },
    accessory: {
      glasses: pick(['none', 'round', 'square'] as const, rand),
      hat: rand() > 0.78 ? 'beanie' : 'none',
    },
    palette: {
      background: int(0, 7, rand),
      clothing: int(0, 7, rand),
    },
    effects: {
      blush: rand() > 0.2,
      gradient: rand() > 0.35,
    },
    theme: pick(['classic', 'soft'] as const, rand),
  }
}
