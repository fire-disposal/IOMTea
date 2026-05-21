import { describe, expect, it } from 'vitest'
import { normalizeMetric, parseHealthPayload } from './router'

describe('mqtt router payload normalization', () => {
  it('normalizes metric aliases', () => {
    expect(normalizeMetric('HR')).toBe('heart_rate')
    expect(normalizeMetric('blood-oxygen')).toBe('spo2')
    expect(normalizeMetric(' body temperature ')).toBe('temperature')
  })

  it('rejects invalid metric names', () => {
    expect(normalizeMetric('')).toBeNull()
    expect(normalizeMetric('??bad')).toBeNull()
    expect(normalizeMetric(123)).toBeNull()
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
