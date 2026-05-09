import { SimulationClock } from './clock'
import type { PatientInstance, SimulatedEvent, WardState, PatientProfile } from './types'
import { generateHeartRate, generateRespiratoryRate, generateTemperature, generateSpO2, generateBedStatus } from './physiology/vitals'
import type { ActivityLevel } from './physiology/vitals'
import { createPatientInstance, type FactoryDeps } from './factory'
import { getProfile } from './profiles'

interface Ward {
  state: WardState
  clock: SimulationClock
  patients: PatientInstance[]
  profileRefs: PatientProfile[]
  intervalId?: ReturnType<typeof setInterval>
  onEvent?: (event: SimulatedEvent) => void
}

const wards = new Map<string, Ward>()

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function tickWard(ward: Ward, db: any): Promise<void> {
  const { events } = await import('../core/db/schema')
  ward.clock.advance()
  const allEvents: SimulatedEvent[] = []

  for (const patient of ward.patients) {
    const profile = ward.profileRefs.find((p) => p.id === patient.profileId)
    if (!profile) continue

    const hour = ward.clock.hourOfDay
    const profileSchedule = profile.schedule
    const isSleepTime = hour < 6 || hour > 21
    const isMealTime = profileSchedule.meals.some(
      (m) => {
        const [h] = m.time.split(':').map(Number)
        return Math.abs(hour - h) < 0.5
      }
    )

    patient.activity = isSleepTime ? 'resting' : isMealTime ? 'light' : pick(['resting', 'resting', 'light'] as ActivityLevel[])

    const hr = generateHeartRate(
      patient.baselines.heartRate.resting,
      patient.baselines.heartRate.variability,
      patient.baselines.heartRate.circadianFactor,
      hour,
      patient.activity,
      ward.clock.tick,
    )

    const rr = generateRespiratoryRate(
      patient.baselines.respiratoryRate.resting,
      patient.baselines.respiratoryRate.variability,
      patient.activity,
      hr,
    )

    const temp = generateTemperature(
      patient.baselines.temperature.resting,
      patient.baselines.temperature.variability,
      hour,
    )

    const spo2 = generateSpO2(
      patient.baselines.spO2.resting,
      patient.baselines.spO2.variability,
    )

    const bed = generateBedStatus(patient.activity, hour, profile.schedule.events)

    const now = ward.clock.simulatedTime

    const obs: SimulatedEvent[] = [
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'heart_rate', value: Math.round(hr), unit: 'bpm', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'resp_rate', value: Math.round(rr), unit: 'rpm', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'temperature', value: Math.round(temp * 10) / 10, unit: '°C', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'spo2', value: Math.round(spo2), unit: '%', tags: { simulated: true }, recordedAt: now },
    ]

    if (bed === 0) {
      obs.push({
        patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'bed_status', value: 0, unit: null, tags: { simulated: true, status: 'empty' }, recordedAt: now,
      })
      allEvents.push({
        patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'alert', metric: 'bed_exit', value: null, unit: null, severity: 'warning', status: 'active', tags: { simulated: true, scenario: 'nocturia' }, recordedAt: now,
      })
    } else {
      obs.push({
        patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'bed_status', value: 1, unit: null, tags: { simulated: true, status: 'in_bed' }, recordedAt: now,
      })
    }

    allEvents.push(...obs)

    for (const rule of profile.alerts) {
      const obsForMetric = obs.find((o) => o.metric === rule.metric)
      if (!obsForMetric || obsForMetric.value === null) continue
      const triggered =
        (rule.condition === 'gt' && obsForMetric.value > rule.threshold) ||
        (rule.condition === 'lt' && obsForMetric.value < rule.threshold) ||
        (rule.condition === 'eq' && obsForMetric.value === rule.threshold)
      if (triggered) {
        allEvents.push({
          patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'alert', metric: rule.metric, value: obsForMetric.value, unit: obsForMetric.unit, severity: rule.severity, status: 'active',
          tags: { simulated: true, rule: rule.message },
          recordedAt: now,
        })
      }
    }
  }

  if (allEvents.length > 0) {
    const rows = allEvents.map((e) => ({
      patientId: e.patientId,
      deviceId: e.deviceId,
      kind: e.kind,
      metric: e.metric,
      value: e.value,
      unit: e.unit,
      severity: e.severity,
      status: e.status,
      tags: e.tags as Record<string, unknown>,
      recordedAt: e.recordedAt,
    }))
    try {
      await db.insert(events).values(rows)
    } catch (err) {
      // DB might not be available yet
    }
  }
}

export async function createWard(
  db: any,
  config: { name: string; patients: { profileId: string; count: number }[]; speed?: number },
): Promise<WardState> {
  const id = config.name.toLowerCase().replace(/\s/g, '-')
  const clock = new SimulationClock()
  clock.speed = config.speed ?? 1

  const deps: FactoryDeps = { db }
  const patientInstances: PatientInstance[] = []
  const profileRefs: PatientProfile[] = []

  for (const pc of config.patients) {
    const profile = getProfile(pc.profileId)
    profileRefs.push(profile)
    for (let i = 0; i < pc.count; i++) {
      const name = `${profile.name} ${i + 1}号`
      const instance = await createPatientInstance(deps, profile, name)
      patientInstances.push(instance)
    }
  }

  const state: WardState = {
    id, name: config.name, speed: clock.speed, running: false,
    patientCount: patientInstances.length, startedAt: null, tick: 0,
  }

  const ward: Ward = { state, clock, patients: patientInstances, profileRefs }

  const startFn = () => {
    state.running = true
    state.startedAt = new Date()
    clock.start()
    ward.intervalId = setInterval(() => tickWard(ward, db), 1000 / clock.speed)
  }

  wards.set(id, ward)
  startFn()

  return state
}

export function getWardState(id: string): WardState | undefined {
  return wards.get(id)?.state
}

export function pauseWard(id: string): boolean {
  const ward = wards.get(id)
  if (!ward) return false
  if (ward.intervalId) clearInterval(ward.intervalId)
  ward.clock.pause()
  ward.state.running = false
  return true
}

export function resumeWard(id: string, db: any): boolean {
  const ward = wards.get(id)
  if (!ward) return false
  ward.clock.start()
  ward.state.running = true
  ward.intervalId = setInterval(() => tickWard(ward, db), 1000 / ward.clock.speed)
  return true
}

export function setWardSpeed(id: string, speed: number): boolean {
  const ward = wards.get(id)
  if (!ward) return false
  ward.clock.speed = speed
  ward.state.speed = speed
  if (ward.intervalId) {
    clearInterval(ward.intervalId)
    const globalDb = (globalThis as Record<string, unknown>).__db as Record<string, unknown> | undefined
    if (globalDb?.db) {
      ward.intervalId = setInterval(() => tickWard(ward, globalDb.db), 1000 / speed)
    }
  }
  return true
}

export function listWards(): WardState[] {
  return Array.from(wards.values()).map((w) => w.state)
}

export function setGlobalDb(db: any): void {
  (globalThis as Record<string, unknown>).__db = { db }
}
