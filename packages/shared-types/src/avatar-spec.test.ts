import { DEFAULT_MII_PARAMS } from './mii-params'
import {
  AVATAR_VERSION,
  AvatarSpecSchema,
  migrateMiiParamsToAvatarSpec,
  parseAvatarSpec,
} from './avatar-spec'

describe('AvatarSpec v2', () => {
  it('parses default migrated spec', () => {
    const migrated = migrateMiiParamsToAvatarSpec(DEFAULT_MII_PARAMS)
    expect(migrated.version).toBe(AVATAR_VERSION)
    expect(() => AvatarSpecSchema.parse(migrated)).not.toThrow()
  })

  it('migrates v1 payload through parseAvatarSpec', () => {
    const migrated = parseAvatarSpec(DEFAULT_MII_PARAMS)
    expect(migrated.version).toBe(AVATAR_VERSION)
    expect(migrated.face.skinTone).toBe(DEFAULT_MII_PARAMS.face.skinTone)
  })

  it('rejects invalid accessory conflict', () => {
    const spec = migrateMiiParamsToAvatarSpec(DEFAULT_MII_PARAMS)
    spec.accessory.hat = 'beanie'
    spec.accessory.glasses = 'round'

    const result = AvatarSpecSchema.safeParse(spec)
    expect(result.success).toBe(false)
  })
})
