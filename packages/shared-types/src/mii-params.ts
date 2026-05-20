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
