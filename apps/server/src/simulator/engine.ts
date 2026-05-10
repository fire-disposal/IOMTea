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
  db: any
}

const wards = new Map<string, Ward>()

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function tickWard(ward: Ward): Promise<void> {
  const { events } = await import('../core/db/schema')
  ward.clock.advance()
  const allEvents: SimulatedEvent[] = []

  for (const patient of ward.patients) {
    const profile = ward.profileRefs.find((p) => p.id === patient.profileId)
    if (!profile) continue

    const hour = ward.clock.hourOfDay
    const profileSchedule = profile.schedule
    const isSleepTime = hour < 6 || hour > 21
    const isMealTime = profileSchedule.meals.some((m) => {
      const [h] = m.time.split(':').map(Number)
      return Math.abs(hour - h) < 0.5
    })

    patient.activity = isSleepTime ? 'resting' : isMealTime ? 'light' : pick(['resting', 'resting', 'light'] as ActivityLevel[])

    const hr = generateHeartRate(patient.baselines.heartRate.resting, patient.baselines.heartRate.variability, patient.baselines.heartRate.circadianFactor, hour, patient.activity, ward.clock.tick)
    const rr = generateRespiratoryRate(patient.baselines.respiratoryRate.resting, patient.baselines.respiratoryRate.variability, patient.activity, hr)
    const temp = generateTemperature(patient.baselines.temperature.resting, patient.baselines.temperature.variability, hour)
    const spo2 = generateSpO2(patient.baselines.spO2.resting, patient.baselines.spO2.variability)
    const bed = generateBedStatus(patient.activity, hour, profile.schedule.events)
    const now = ward.clock.simulatedTime

    const obs: SimulatedEvent[] = [
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'heart_rate', value: Math.round(hr), unit: 'bpm', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'resp_rate', value: Math.round(rr), unit: 'rpm', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'temperature', value: Math.round(temp * 10) / 10, unit: '°C', tags: { simulated: true }, recordedAt: now },
      { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'spo2', value: Math.round(spo2), unit: '%', tags: { simulated: true }, recordedAt: now },
    ]

    const bedObs: SimulatedEvent = bed === 0
      ? { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'bed_status', value: 0, unit: null, tags: { simulated: true, status: 'empty' }, recordedAt: now }
      : { patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'observation', metric: 'bed_status', value: 1, unit: null, tags: { simulated: true, status: 'in_bed' }, recordedAt: now }
    obs.push(bedObs)

    if (bed === 0) {
      allEvents.push({ patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'alert', metric: 'bed_exit', value: null, unit: null, severity: 'warning', status: 'active', tags: { simulated: true, scenario: 'nocturia' }, recordedAt: now })
    }

    allEvents.push(...obs)

    for (const rule of profile.alerts) {
      const obsForMetric = obs.find((o) => o.metric === rule.metric)
      if (!obsForMetric || obsForMetric.value === null) continue
      const triggered = (rule.condition === 'gt' && obsForMetric.value > rule.threshold) || (rule.condition === 'lt' && obsForMetric.value < rule.threshold) || (rule.condition === 'eq' && obsForMetric.value === rule.threshold)
      if (triggered) {
        allEvents.push({ patientId: patient.patientDbId, deviceId: patient.deviceDbId, kind: 'alert', metric: rule.metric, value: obsForMetric.value, unit: obsForMetric.unit, severity: rule.severity, status: 'active', tags: { simulated: true, rule: rule.message }, recordedAt: now })
      }
    }
  }

  if (allEvents.length > 0) {
    const rows = allEvents.map((e) => ({
      patientId: e.patientId, deviceId: e.deviceId, kind: e.kind, metric: e.metric, value: e.value, unit: e.unit,
      severity: e.severity, status: e.status, tags: e.tags as Record<string, unknown>, recordedAt: e.recordedAt,
    }))
    try { await ward.db.insert(events).values(rows) } catch { /* DB unavailable */ }
  }
}

function startInterval(ward: Ward): void {
  ward.intervalId = setInterval(() => tickWard(ward), 1000 / ward.clock.speed)
}

function clearWardInterval(ward: Ward): void {
  if (ward.intervalId) clearInterval(ward.intervalId)
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
      patientInstances.push(await createPatientInstance(deps, profile, `${profile.name} ${i + 1}号`))
    }
  }

  const state: WardState = { id, name: config.name, speed: clock.speed, running: false, patientCount: patientInstances.length, startedAt: null, tick: 0 }
  const ward: Ward = { state, clock, patients: patientInstances, profileRefs, db }

  state.running = true
  state.startedAt = new Date()
  clock.start()
  startInterval(ward)
  wards.set(id, ward)
  return state
}

export function getWardState(id: string): WardState | undefined {
  return wards.get(id)?.state
}

export function pauseWard(id: string): boolean {
  const ward = wards.get(id)
  if (!ward) return false
  clearWardInterval(ward)
  ward.clock.pause()
  ward.state.running = false
  return true
}

export function resumeWard(id: string): boolean {
  const ward = wards.get(id)
  if (!ward) return false
  ward.clock.start()
  ward.state.running = true
  startInterval(ward)
  return true
}

export function setWardSpeed(id: string, speed: number): boolean {
  const ward = wards.get(id)
  if (!ward) return false
  ward.clock.speed = speed
  ward.state.speed = speed
  clearWardInterval(ward)
  startInterval(ward)
  return true
}

export function listWards(): WardState[] {
  return Array.from(wards.values()).map((w) => w.state)
}

export async function injectScenario(wardId: string, type: string): Promise<boolean> {
  const ward = wards.get(wardId)
  if (!ward) return false

  const { events } = await import('../core/db/schema')
  const now = ward.clock.simulatedTime
  const rows: any[] = []

  for (const patient of ward.patients) {
    const pt = patient.patientDbId
    const dev = patient.deviceDbId

    if (type === 'bed_exit') {
      rows.push(
        { patientId: pt, deviceId: dev, kind: 'observation', metric: 'bed_status', value: 0, unit: null, tags: { simulated: true, scenario: 'demo_exit', status: 'empty' }, recordedAt: now },
        { patientId: pt, deviceId: dev, kind: 'alert', metric: 'bed_exit', value: null, unit: null, severity: 'warning', status: 'active', tags: { simulated: true, scenario: 'demo', message: '患者离床' }, recordedAt: now },
      )
    } else if (type === 'tachycardia') {
      rows.push(
        { patientId: pt, deviceId: dev, kind: 'observation', metric: 'heart_rate', value: 155, unit: 'bpm', tags: { simulated: true, scenario: 'demo' }, recordedAt: now },
        { patientId: pt, deviceId: dev, kind: 'alert', metric: 'heart_rate', value: 155, unit: 'bpm', severity: 'critical', status: 'active', tags: { simulated: true, scenario: 'demo', message: '心动过速' }, recordedAt: now },
      )
    } else if (type === 'fall') {
      rows.push(
        { patientId: pt, deviceId: dev, kind: 'observation', metric: 'fall_detected', value: 1, unit: null, tags: { simulated: true, scenario: 'demo' }, recordedAt: now },
        { patientId: pt, deviceId: dev, kind: 'alert', metric: 'fall_detected', value: 1, unit: null, severity: 'critical', status: 'active', tags: { simulated: true, scenario: 'demo', message: '跌倒检测' }, recordedAt: now },
      )
    } else if (type === 'low_spo2') {
      rows.push(
        { patientId: pt, deviceId: dev, kind: 'observation', metric: 'spo2', value: 87, unit: '%', tags: { simulated: true, scenario: 'demo' }, recordedAt: now },
        { patientId: pt, deviceId: dev, kind: 'alert', metric: 'spo2', value: 87, unit: '%', severity: 'critical', status: 'active', tags: { simulated: true, scenario: 'demo', message: '低血氧' }, recordedAt: now },
      )
    }
  }

  if (rows.length > 0) {
    await ward.db.insert(events).values(rows)
  }
  return true
}
