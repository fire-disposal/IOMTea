import { DEFAULT_AVATAR_SPEC, type AvatarSpec } from '@iomtea/shared-types'
import { randomAvatarSpec } from './random'
import { renderAvatarSvg } from './render'

describe('renderAvatarSvg', () => {
  it('renders deterministic output from seeded random', () => {
    const a = renderAvatarSvg(randomAvatarSpec('seed-1'))
    const b = renderAvatarSvg(randomAvatarSpec('seed-1'))
    expect(a).toBe(b)
  })

  it('renders valid svg for default spec', () => {
    const svg = renderAvatarSvg(DEFAULT_AVATAR_SPEC)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.includes('viewBox="0 0 256 256"')).toBe(true)
    expect(svg.includes('path')).toBe(true)
  })

  it('includes expected front-face layers', () => {
    const spec: AvatarSpec = {
      ...DEFAULT_AVATAR_SPEC,
      accessory: { glasses: 'round', hat: 'none' },
    }
    const svg = renderAvatarSvg(spec)
    expect(svg).toContain('circle')
    expect(svg).toContain('ellipse')
  })
})
