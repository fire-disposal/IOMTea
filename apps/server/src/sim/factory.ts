import type { DbClient } from '../core/db'
import { events } from '../core/db/schema'
import { profiles } from './profiles'
import * as phys from './physiology'
import { MetricScheduler } from './scheduler'
import type { Profile, SimStatus } from './types'

interface SimInstance {
  patientId: string
  patientName: string
  profile: Profile
  scheduler: MetricScheduler
  lastValues: Record<string, number>
  tickCount: number
}

const instances = new Map<string, SimInstance>()
let globalSpeed = 1

type GeneratorFn = (baseline: { mean: number; std: number }, hour: number, prev?: number) => number | string

const generatorMap: Record<string, GeneratorFn> = {
  heartRate: phys.generateHeartRate as GeneratorFn,
  spo2: phys.generateSpO2 as GeneratorFn,
  temperature: phys.generateTemperature as GeneratorFn,
  systolicBp: phys.generateSystolicBp as GeneratorFn,
  diastolicBp: phys.generateDiastolicBp as GeneratorFn,
  glucose: phys.generateGlucose as GeneratorFn,
  respiratoryRate: phys.generateRespiratoryRate as GeneratorFn,
  posture: (() => phys.generatePosture()) as unknown as GeneratorFn,
  bedStatus: (() => phys.generateBedStatus()) as unknown as GeneratorFn,
  motionIndex: (() => phys.generateMotionIndex()) as unknown as GeneratorFn,
}

export function startSim(
  db: DbClient,
  patientIds: string[],
  patientNames: Map<string, string>,
  profileName: string,
  overrides?: Record<string, { intervalMin: number; intervalMax: number; jitter: number }>,
) {
  const profile = profiles[profileName]
  if (!profile) return

  for (const pid of patientIds) {
    if (instances.has(pid)) continue
    const scheduler = new MetricScheduler()
    scheduler.setSpeed(globalSpeed)

    const customMetrics = profile.metrics.map((m) => {
      const ov = overrides?.[m.metric]
      if (ov) {
        return { ...m, interval: { min: ov.intervalMin, max: ov.intervalMax }, jitter: ov.jitter }
      }
      return m
    })

    const instance: SimInstance = {
      patientId: pid,
      patientName: patientNames.get(pid) ?? pid,
      profile: { ...profile, metrics: customMetrics },
      scheduler,
      lastValues: {},
      tickCount: 0,
    }
    instances.set(pid, instance)

    for (const metricCfg of customMetrics) {
      const generator = generatorMap[metricCfg.generator]
      if (!generator) continue
      scheduler.schedule(pid, metricCfg, async (_metric) => {
        const inst = instances.get(pid)
        if (!inst) return
        const baseline = profile.baselines[metricCfg.metric]
        if (!baseline) return
        const hour = new Date().getHours()
        const value = generator(baseline, hour)
        inst.lastValues[metricCfg.metric] = typeof value === 'number' ? value : 0
        inst.tickCount++

        await db.insert(events).values({
          patientId: pid,
          kind: 'observation',
          metric: metricCfg.metric,
          value: typeof value === 'number' ? value : null,
          unit: metricCfg.unit || null,
          source: 'simulator',
          recordedAt: new Date(),
          tags: { sim: true, profile: profileName },
        } as any)
      })
    }
  }
}

export function stopSim(patientIds: string[]) {
  for (const pid of patientIds) {
    const inst = instances.get(pid)
    if (inst) {
      inst.scheduler.destroy()
      instances.delete(pid)
    }
  }
}

export function setGlobalSpeed(speed: number) {
  globalSpeed = speed
  for (const inst of instances.values()) inst.scheduler.setSpeed(speed)
}

export function getStatus(): SimStatus[] {
  return Array.from(instances.values()).map((i) => ({
    patientId: i.patientId,
    patientName: i.patientName,
    profile: i.profile.name,
    running: true,
    lastValues: i.lastValues,
    tickCount: i.tickCount,
  }))
}

export function getProfileConfig(profileName: string) {
  return profiles[profileName]?.metrics ?? []
}
