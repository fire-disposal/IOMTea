import { describe, it, expect } from 'vitest'
import {
  generateHeartRate,
  generateRespiratoryRate,
  generateTemperature,
  generateSpO2,
  generateBedStatus,
} from './vitals'

describe('generateHeartRate', () => {
  it('returns resting HR near baseline', () => {
    const hr = generateHeartRate(72, 3, 5, 12, 'resting', 0)
    expect(hr).toBeGreaterThanOrEqual(30)
    expect(hr).toBeLessThanOrEqual(220)
  })

  it('returns elevated HR during heavy activity vs resting', () => {
    // run multiple times to account for randomness
    const restingSamples: number[] = []
    const heavySamples: number[] = []
    for (let i = 0; i < 100; i++) {
      restingSamples.push(generateHeartRate(72, 3, 5, 12, 'resting', i))
      heavySamples.push(generateHeartRate(72, 3, 5, 12, 'heavy', i))
    }
    const avgResting = restingSamples.reduce((a, b) => a + b) / restingSamples.length
    const avgHeavy = heavySamples.reduce((a, b) => a + b) / heavySamples.length
    expect(avgHeavy).toBeGreaterThan(avgResting)
  })

  it('returns number type', () => {
    expect(typeof generateHeartRate(72, 3, 5, 12, 'resting', 0)).toBe('number')
  })
})

describe('generateRespiratoryRate', () => {
  it('returns near-baseline RR at rest', () => {
    const rr = generateRespiratoryRate(16, 2, 'resting', 72)
    expect(rr).toBeGreaterThanOrEqual(6)
    expect(rr).toBeLessThanOrEqual(40)
  })

  it('returns elevated RR during heavy activity', () => {
    const restingSamples: number[] = []
    const heavySamples: number[] = []
    for (let i = 0; i < 100; i++) {
      restingSamples.push(generateRespiratoryRate(16, 2, 'resting', 72))
      heavySamples.push(generateRespiratoryRate(16, 2, 'heavy', 120))
    }
    const avgResting = restingSamples.reduce((a, b) => a + b) / restingSamples.length
    const avgHeavy = heavySamples.reduce((a, b) => a + b) / heavySamples.length
    expect(avgHeavy).toBeGreaterThan(avgResting)
  })
})

describe('generateTemperature', () => {
  it('returns near-baseline temperature', () => {
    const temp = generateTemperature(36.8, 0.2, 12)
    expect(temp).toBeGreaterThanOrEqual(35.5)
    expect(temp).toBeLessThanOrEqual(42)
  })

  it('clamps within physiological bounds', () => {
    for (let i = 0; i < 100; i++) {
      const temp = generateTemperature(36.8, 1.0, 12)
      expect(temp).toBeGreaterThanOrEqual(35.5)
      expect(temp).toBeLessThanOrEqual(42)
    }
  })
})

describe('generateSpO2', () => {
  it('returns near-normal SpO2', () => {
    const spo2 = generateSpO2(97, 1)
    expect(spo2).toBeGreaterThanOrEqual(85)
    expect(spo2).toBeLessThanOrEqual(100)
  })

  it('stays at or below 100', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateSpO2(97, 2)).toBeLessThanOrEqual(100)
    }
  })
})

describe('generateBedStatus', () => {
  it('returns 1 during sleep hours (22-6) with resting activity', () => {
    const events = [
      { type: 'bed_exit', window: ['06:00' as string, '08:00' as string], probability: 0.8 },
    ]
    const bed = generateBedStatus('resting', 23, events)
    expect(bed).toBe(1)
  })

  it('returns 0 during daytime with light activity', () => {
    const events = [
      { type: 'bed_exit', window: ['06:00' as string, '08:00' as string], probability: 0.8 },
    ]
    const bed = generateBedStatus('light', 14, events)
    expect(bed).toBe(0)
  })
})
