import { describe, expect, it } from 'vitest'
import { parseHealthPayload } from './router'

describe('mqtt router payload normalization', () => {
  it('normalizes metric aliases', () => {
    let parsed = parseHealthPayload({ metric: 'HR', value: '75' })
    expect(parsed?.metric).toBe('heart_rate')
    parsed = parseHealthPayload({ metric: 'blood-oxygen', value: '95' })
    expect(parsed?.metric).toBe('spo2')
    parsed = parseHealthPayload({ metric: ' body temperature ', value: '36.5' })
    expect(parsed?.metric).toBe('temperature')
  })

  it('rejects invalid payloads', () => {
    expect(parseHealthPayload({ metric: '', value: '75' })).toBeNull()
    expect(parseHealthPayload({})).toBeNull()
    expect(parseHealthPayload({ metric: 123, value: '75' })).toBeNull()
  })

  it('parses valid payload and infers unit', () => {
    const parsed = parseHealthPayload({ metric: 'hr', value: '75' })
    expect(parsed).not.toBeNull()
    expect(parsed?.metric).toBe('heart_rate')
    expect(parsed?.value).toBe(75)
    expect(parsed?.unit).toBe('bpm')
  })

  it('rejects out-of-range values', () => {
    const parsed = parseHealthPayload({ metric: 'spo2', value: 10 })
    expect(parsed).toBeNull()
  })
})
