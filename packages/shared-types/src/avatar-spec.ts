import { z } from 'zod'
import { DEFAULT_MII_PARAMS, type MiiParams } from './mii-params'

export const AVATAR_VERSION = 2 as const

export const AvatarFaceShapeSchema = z.enum(['round', 'oval', 'square'])
export const AvatarEyeStyleSchema = z.enum(['round', 'almond', 'smile'])
export const AvatarBrowStyleSchema = z.enum(['soft', 'flat', 'sharp'])
export const AvatarNoseStyleSchema = z.enum(['dot', 'small', 'long'])
export const AvatarMouthStyleSchema = z.enum(['smile', 'neutral', 'laugh'])
export const AvatarHairStyleSchema = z.enum(['short', 'long', 'buzz', 'curly'])
export const AvatarGlassesStyleSchema = z.enum(['none', 'round', 'square'])
export const AvatarHatStyleSchema = z.enum(['none', 'beanie'])
export const AvatarThemeSchema = z.enum(['classic', 'soft'])

export const AvatarSpecSchema = z.object({
  version: z.literal(AVATAR_VERSION),
  seed: z.number().int().optional(),
  face: z.object({
    shape: AvatarFaceShapeSchema,
    skinTone: z.number().int().min(0).max(5),
    headScale: z.number().min(0.8).max(1.2),
    jawRoundness: z.number().min(0).max(1),
  }),
  eyes: z.object({
    style: AvatarEyeStyleSchema,
    size: z.number().min(0.6).max(1.4),
    spacing: z.number().min(0.6).max(1.5),
    height: z.number().min(0.3).max(0.7),
    color: z.number().int().min(0).max(5),
  }),
  brows: z.object({
    style: AvatarBrowStyleSchema,
    angle: z.number().min(-1).max(1),
    thickness: z.number().min(0.6).max(1.5),
  }),
  nose: z.object({
    style: AvatarNoseStyleSchema,
    width: z.number().min(0.6).max(1.4),
    height: z.number().min(0.6).max(1.4),
  }),
  mouth: z.object({
    style: AvatarMouthStyleSchema,
    width: z.number().min(0.6).max(1.4),
    openness: z.number().min(0).max(1),
  }),
  hair: z.object({
    style: AvatarHairStyleSchema,
    color: z.number().int().min(0).max(7),
  }),
  accessory: z.object({
    glasses: AvatarGlassesStyleSchema,
    hat: AvatarHatStyleSchema,
  }).superRefine((value, ctx) => {
    if (value.hat === 'beanie' && value.glasses === 'round') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'beanie 与 round 眼镜组合在 v2 中不可用',
        path: ['glasses'],
      })
    }
  }),
  palette: z.object({
    background: z.number().int().min(0).max(7),
    clothing: z.number().int().min(0).max(7),
  }),
  effects: z.object({
    blush: z.boolean(),
    gradient: z.boolean(),
  }),
  theme: AvatarThemeSchema,
})

export type AvatarSpec = z.infer<typeof AvatarSpecSchema>

export type AvatarEditorField = {
  section: string
  key: string
  label: string
  control: 'slider' | 'select'
  options?: Array<{ value: string | number; label: string }>
  min?: number
  max?: number
  step?: number
}

const styleOptions = <T extends string>(values: readonly T[], labels: readonly string[]) =>
  values.map((value, index) => ({ value, label: labels[index] ?? String(value) }))

export const AVATAR_EDITOR_FIELDS: AvatarEditorField[] = [
  {
    section: '脸型',
    key: 'face.shape',
    label: '脸型',
    control: 'select',
    options: styleOptions(['round', 'oval', 'square'] as const, ['圆脸', '椭圆', '方脸']),
  },
  {
    section: '脸型',
    key: 'face.skinTone',
    label: '肤色',
    control: 'select',
    options: [0, 1, 2, 3, 4, 5].map((value) => ({ value, label: `肤色 ${value + 1}` })),
  },
  {
    section: '脸型',
    key: 'face.headScale',
    label: '头部比例',
    control: 'slider',
    min: 0.8,
    max: 1.2,
    step: 0.01,
  },
  {
    section: '脸型',
    key: 'face.jawRoundness',
    label: '下颌圆润度',
    control: 'slider',
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    section: '眼睛',
    key: 'eyes.style',
    label: '眼型',
    control: 'select',
    options: styleOptions(['round', 'almond', 'smile'] as const, ['圆眼', '杏眼', '笑眼']),
  },
  {
    section: '眼睛',
    key: 'eyes.size',
    label: '眼睛大小',
    control: 'slider',
    min: 0.6,
    max: 1.4,
    step: 0.01,
  },
  {
    section: '眼睛',
    key: 'eyes.spacing',
    label: '眼距',
    control: 'slider',
    min: 0.6,
    max: 1.5,
    step: 0.01,
  },
  {
    section: '眼睛',
    key: 'eyes.height',
    label: '眼睛高度',
    control: 'slider',
    min: 0.3,
    max: 0.7,
    step: 0.01,
  },
  {
    section: '眼睛',
    key: 'eyes.color',
    label: '瞳色',
    control: 'select',
    options: [0, 1, 2, 3, 4, 5].map((value) => ({ value, label: `瞳色 ${value + 1}` })),
  },
  {
    section: '眉毛',
    key: 'brows.style',
    label: '眉型',
    control: 'select',
    options: styleOptions(['soft', 'flat', 'sharp'] as const, ['柔和', '平眉', '上挑']),
  },
  {
    section: '眉毛',
    key: 'brows.angle',
    label: '眉角',
    control: 'slider',
    min: -1,
    max: 1,
    step: 0.01,
  },
  {
    section: '眉毛',
    key: 'brows.thickness',
    label: '眉毛粗细',
    control: 'slider',
    min: 0.6,
    max: 1.5,
    step: 0.01,
  },
  {
    section: '鼻子',
    key: 'nose.style',
    label: '鼻型',
    control: 'select',
    options: styleOptions(['dot', 'small', 'long'] as const, ['点鼻', '小鼻', '长鼻']),
  },
  {
    section: '鼻子',
    key: 'nose.width',
    label: '鼻宽',
    control: 'slider',
    min: 0.6,
    max: 1.4,
    step: 0.01,
  },
  {
    section: '鼻子',
    key: 'nose.height',
    label: '鼻高',
    control: 'slider',
    min: 0.6,
    max: 1.4,
    step: 0.01,
  },
  {
    section: '嘴巴',
    key: 'mouth.style',
    label: '嘴型',
    control: 'select',
    options: styleOptions(['smile', 'neutral', 'laugh'] as const, ['微笑', '中性', '大笑']),
  },
  {
    section: '嘴巴',
    key: 'mouth.width',
    label: '嘴宽',
    control: 'slider',
    min: 0.6,
    max: 1.4,
    step: 0.01,
  },
  {
    section: '嘴巴',
    key: 'mouth.openness',
    label: '开口',
    control: 'slider',
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    section: '头发',
    key: 'hair.style',
    label: '发型',
    control: 'select',
    options: styleOptions(['short', 'long', 'buzz', 'curly'] as const, ['短发', '长发', '寸头', '卷发']),
  },
  {
    section: '头发',
    key: 'hair.color',
    label: '发色',
    control: 'select',
    options: [0, 1, 2, 3, 4, 5, 6, 7].map((value) => ({ value, label: `发色 ${value + 1}` })),
  },
  {
    section: '配饰',
    key: 'accessory.glasses',
    label: '眼镜',
    control: 'select',
    options: styleOptions(['none', 'round', 'square'] as const, ['无', '圆框', '方框']),
  },
  {
    section: '配饰',
    key: 'accessory.hat',
    label: '帽子',
    control: 'select',
    options: styleOptions(['none', 'beanie'] as const, ['无', '毛线帽']),
  },
  {
    section: '配色',
    key: 'palette.background',
    label: '背景色',
    control: 'select',
    options: [0, 1, 2, 3, 4, 5, 6, 7].map((value) => ({ value, label: `背景 ${value + 1}` })),
  },
  {
    section: '配色',
    key: 'palette.clothing',
    label: '衣服色',
    control: 'select',
    options: [0, 1, 2, 3, 4, 5, 6, 7].map((value) => ({ value, label: `衣服 ${value + 1}` })),
  },
  {
    section: '效果',
    key: 'effects.blush',
    label: '腮红',
    control: 'select',
    options: [
      { value: 1, label: '开' },
      { value: 0, label: '关' },
    ],
  },
  {
    section: '效果',
    key: 'effects.gradient',
    label: '渐变背景',
    control: 'select',
    options: [
      { value: 1, label: '开' },
      { value: 0, label: '关' },
    ],
  },
  {
    section: '主题',
    key: 'theme',
    label: '主题',
    control: 'select',
    options: styleOptions(['classic', 'soft'] as const, ['经典', '柔和']),
  },
]

export const DEFAULT_AVATAR_SPEC: AvatarSpec = {
  version: AVATAR_VERSION,
  face: {
    shape: 'oval',
    skinTone: 2,
    headScale: 1,
    jawRoundness: 0.6,
  },
  eyes: {
    style: 'almond',
    size: 1,
    spacing: 1,
    height: 0.5,
    color: 0,
  },
  brows: {
    style: 'soft',
    angle: 0,
    thickness: 1,
  },
  nose: {
    style: 'small',
    width: 1,
    height: 1,
  },
  mouth: {
    style: 'smile',
    width: 1,
    openness: 0.35,
  },
  hair: {
    style: 'short',
    color: 0,
  },
  accessory: {
    glasses: 'none',
    hat: 'none',
  },
  palette: {
    background: 1,
    clothing: 4,
  },
  effects: {
    blush: true,
    gradient: true,
  },
  theme: 'classic',
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function migrateMiiParamsToAvatarSpec(input: MiiParams = DEFAULT_MII_PARAMS): AvatarSpec {
  const mouth = input.face.mouthShape
  const hairStyle = input.face.hairStyle
  const eyeStyle = input.face.eyeStyle

  return {
    version: AVATAR_VERSION,
    seed: input.seed,
    face: {
      shape: input.face.headWidth > 0.58 ? 'round' : input.face.headHeight > 0.58 ? 'oval' : 'square',
      skinTone: clamp(input.face.skinTone, 0, 5),
      headScale: 0.8 + clamp((input.face.headWidth + input.face.headHeight) / 2, 0, 1) * 0.4,
      jawRoundness: clamp((input.face.headWidth + (1 - input.face.headHeight)) / 2, 0, 1),
    },
    eyes: {
      style: eyeStyle === 0 ? 'round' : eyeStyle === 1 ? 'almond' : 'smile',
      size: 0.6 + clamp(input.face.eyeSize, 0, 1) * 0.8,
      spacing: 0.6 + clamp(input.face.eyeSpacing, 0, 1) * 0.9,
      height: 0.3 + clamp(input.face.eyeHeight, 0, 1) * 0.4,
      color: clamp(input.face.eyeColor, 0, 5),
    },
    brows: {
      style: input.face.eyebrowAngle > 0.25 ? 'sharp' : input.face.eyebrowAngle < -0.25 ? 'flat' : 'soft',
      angle: clamp(input.face.eyebrowAngle, -1, 1),
      thickness: 0.6 + clamp(input.face.eyebrowHeight, 0, 1) * 0.9,
    },
    nose: {
      style: input.face.noseHeight > 0.66 ? 'long' : input.face.noseWidth < 0.36 ? 'dot' : 'small',
      width: 0.6 + clamp(input.face.noseWidth, 0, 1) * 0.8,
      height: 0.6 + clamp(input.face.noseHeight, 0, 1) * 0.8,
    },
    mouth: {
      style: mouth === 1 ? 'neutral' : mouth >= 2 ? 'laugh' : 'smile',
      width: 0.6 + clamp(input.face.mouthWidth, 0, 1) * 0.8,
      openness: clamp(input.face.mouthHeight, 0, 1),
    },
    hair: {
      style: hairStyle <= 2 ? 'short' : hairStyle <= 5 ? 'long' : hairStyle <= 8 ? 'buzz' : 'curly',
      color: clamp(input.face.hairColor, 0, 7),
    },
    accessory: {
      glasses: input.face.accessory === 1 ? 'round' : input.face.accessory === 2 ? 'square' : 'none',
      hat: input.face.accessory >= 3 ? 'beanie' : 'none',
    },
    palette: {
      background: (clamp(input.face.skinTone, 0, 5) + 1) % 8,
      clothing: (clamp(input.face.hairColor, 0, 7) + 3) % 8,
    },
    effects: {
      blush: input.face.skinTone <= 3,
      gradient: true,
    },
    theme: 'classic',
  }
}

export function parseAvatarSpec(input: unknown): AvatarSpec {
  const parsed = AvatarSpecSchema.safeParse(input)
  if (parsed.success) {
    return parsed.data
  }

  const maybeV1 = z.object({
    version: z.literal(1),
    face: z.record(z.any()),
    seed: z.number().optional(),
  }).safeParse(input)

  if (maybeV1.success) {
    return migrateMiiParamsToAvatarSpec(input as MiiParams)
  }

  throw new Error(parsed.error.issues.map((issue) => issue.message).join('; '))
}
