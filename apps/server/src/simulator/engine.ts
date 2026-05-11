import { broadcastManager } from '../core/realtime/broadcast'
import { SimulationClock } from './clock'
import { type FactoryDeps, createPatientInstance } from './factory'
import { generateBloodPressure } from './physiology/blood-pressure'
import { generateECGSamples } from './physiology/ecg-waveform'
import { generateGlucose } from './physiology/glucose'
import { generateMotionIndex } from './physiology/motion'
import { generatePosture } from './physiology/posture'
import { generatePressureDistribution } from './physiology/pressure-distribution'
import { generateRespiratoryWaveform } from './physiology/respiratory-waveform'
import {
  generateBedStatus,
  generateHeartRate,
  generateRespiratoryRate,
  generateSpO2,
  generateTemperature,
} from './physiology/vitals'
import { getProfile } from './profiles'
import type { PatientInstance, PatientProfile, Posture, SimulatedEvent, WardState } from './types'
import type { ActivityLevel, ScenarioType } from './types'

interface Ward {
  state: WardState
  clock: SimulationClock
  patients: PatientInstance[]
  profileRefs: PatientProfile[]
  intervalId?: ReturnType<typeof setInterval>
  db: any
  entityStates: Map<string, { state: string; tileX: number; tileY: number; posture: string }>
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
    const [sleepStartH] = profileSchedule.sleep.start.split(':').map(Number)
    const [sleepEndH] = profileSchedule.sleep.end.split(':').map(Number)
    const isSleepTime =
      sleepEndH < sleepStartH
        ? hour >= sleepStartH || hour < sleepEndH
        : hour >= sleepStartH && hour < sleepEndH
    const isMealTime = profileSchedule.meals.some((m) => {
      const [h] = m.time.split(':').map(Number)
      return Math.abs(hour - h) < 0.5
    })

    patient.activity = isSleepTime
      ? 'resting'
      : isMealTime
        ? 'light'
        : pick(['resting', 'resting', 'light'] as ActivityLevel[])

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
    const spo2 = generateSpO2(patient.baselines.spO2.resting, patient.baselines.spO2.variability)
    const bed = generateBedStatus(patient.activity, hour, profile.schedule.events)

    const bp = generateBloodPressure(
      patient.baselines.bloodPressure.systolic,
      patient.baselines.bloodPressure.diastolic,
      patient.baselines.bloodPressure.variability,
      hour,
      patient.activity,
      hr,
    )

    const simMinutes =
      ward.clock.simulatedTime.getHours() * 60 + ward.clock.simulatedTime.getMinutes()
    const glucose = generateGlucose(
      patient.baselines.bloodGlucose.fasting,
      patient.baselines.bloodGlucose.variability,
      patient.baselines.bloodGlucose.postprandialSpike,
      hour,
      profile.schedule.meals,
      simMinutes,
    )

    const motion = generateMotionIndex(patient.activity)

    const patientData = patient as PatientInstance & { posture?: Posture }
    const posture = generatePosture(patient.activity, hour, bed, patientData.posture || 'lying')
    patientData.posture = posture

    const ecgSamples = generateECGSamples(Math.round(hr))
    const respSamples = generateRespiratoryWaveform(Math.round(rr))

    const weight =
      profile.demographics.weightRange[0] +
      Math.random() * (profile.demographics.weightRange[1] - profile.demographics.weightRange[0])
    const pressureGrid = generatePressureDistribution(posture, weight)

    const now = ward.clock.simulatedTime

    const obs: SimulatedEvent[] = [
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'heart_rate',
        value: Math.round(hr),
        unit: 'bpm',
        tags: { simulated: true },
        recordedAt: now,
      },
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'resp_rate',
        value: Math.round(rr),
        unit: 'rpm',
        tags: { simulated: true },
        recordedAt: now,
      },
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'temperature',
        value: Math.round(temp * 10) / 10,
        unit: '\u00b0C',
        tags: { simulated: true },
        recordedAt: now,
      },
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'spo2',
        value: Math.round(spo2),
        unit: '%',
        tags: { simulated: true },
        recordedAt: now,
      },
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'systolic_bp',
        value: bp.systolic,
        unit: 'mmHg',
        tags: { simulated: true },
        recordedAt: now,
      },
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'diastolic_bp',
        value: bp.diastolic,
        unit: 'mmHg',
        tags: { simulated: true },
        recordedAt: now,
      },
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'glucose',
        value: glucose,
        unit: 'mmol/L',
        tags: { simulated: true },
        recordedAt: now,
      },
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'motion_index',
        value: motion,
        unit: 'g',
        tags: { simulated: true },
        recordedAt: now,
      },
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'posture',
        value: null,
        unit: null,
        tags: { simulated: true, posture },
        recordedAt: now,
      },
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'ecg_waveform',
        value: null,
        unit: null,
        tags: { simulated: true, waveform: ecgSamples },
        recordedAt: now,
      },
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'resp_waveform',
        value: null,
        unit: null,
        tags: { simulated: true, waveform: respSamples },
        recordedAt: now,
      },
      {
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'observation',
        metric: 'pressure_grid',
        value: null,
        unit: null,
        tags: { simulated: true, grid: pressureGrid, posture },
        recordedAt: now,
      },
    ]

    const bedObs: SimulatedEvent =
      bed === 0
        ? {
            patientId: patient.patientDbId,
            deviceId: patient.deviceDbId,
            kind: 'observation',
            metric: 'bed_status',
            value: 0,
            unit: null,
            tags: { simulated: true, status: 'empty' },
            recordedAt: now,
          }
        : {
            patientId: patient.patientDbId,
            deviceId: patient.deviceDbId,
            kind: 'observation',
            metric: 'bed_status',
            value: 1,
            unit: null,
            tags: { simulated: true, status: 'in_bed' },
            recordedAt: now,
          }
    obs.push(bedObs)

    if (bed === 0 && isSleepTime) {
      allEvents.push({
        patientId: patient.patientDbId,
        deviceId: patient.deviceDbId,
        kind: 'alert',
        metric: 'bed_exit',
        value: null,
        unit: null,
        severity: 'warning',
        status: 'active',
        tags: { simulated: true, scenario: 'nocturia' },
        recordedAt: now,
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
          patientId: patient.patientDbId,
          deviceId: patient.deviceDbId,
          kind: 'alert',
          metric: rule.metric,
          value: obsForMetric.value,
          unit: obsForMetric.unit,
          severity: rule.severity,
          status: 'active',
          tags: { simulated: true, rule: rule.message },
          recordedAt: now,
        })
      }
    }

    for (const ct of patient.customThresholds || []) {
      if (!ct.enabled) continue
      const obsForMetric = obs.find((o) => o.metric === ct.metric)
      if (!obsForMetric || obsForMetric.value === null) continue
      const val = obsForMetric.value as number
      if (ct.min !== undefined && val < ct.min) {
        allEvents.push({
          patientId: patient.patientDbId,
          deviceId: patient.deviceDbId,
          kind: 'alert',
          metric: ct.metric,
          value: val,
          unit: obsForMetric.unit,
          severity: 'warning',
          status: 'active',
          tags: { simulated: true, rule: `${ct.metric}低于下限${ct.min}`, custom: true },
          recordedAt: now,
        })
      }
      if (ct.max !== undefined && val > ct.max) {
        allEvents.push({
          patientId: patient.patientDbId,
          deviceId: patient.deviceDbId,
          kind: 'alert',
          metric: ct.metric,
          value: val,
          unit: obsForMetric.unit,
          severity: 'warning',
          status: 'active',
          tags: { simulated: true, rule: `${ct.metric}超过上限${ct.max}`, custom: true },
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
      await ward.db.insert(events).values(rows)
    } catch (err) {
      console.warn('simulator: failed to persist events', err)
    }

    const broadcastPayload = allEvents.map((e) => ({
      patientId: e.patientId,
      deviceId: e.deviceId,
      kind: e.kind,
      metric: e.metric,
      value: e.value,
      unit: e.unit,
      severity: e.severity ?? null,
      status: e.status ?? null,
      tags: e.tags,
      recordedAt: e.recordedAt.toISOString(),
    }))

    // Compute entity states from patient activity
    const entityStatePayload = ward.patients.map((p, i) => {
      const entityId = `person-${i + 1}`
      const tileX = p.activity === 'resting' ? 1 + (i % 3) * 5 : 6 + (i % 3)
      const tileY = p.activity === 'resting' ? 1 + Math.floor(i / 3) * 5 : 2 + Math.floor(i / 3) * 3
      const posture = p.activity === 'resting' ? 'lying' : 'standing'
      ward.entityStates.set(entityId, { state: p.activity === 'resting' ? 'idle' : 'idle', tileX, tileY, posture })
      return { entityId, state: 'idle', tileX, tileY, posture }
    })

    const simTime = ward.clock.simulatedTime
    broadcastManager.broadcast(
      ward.state.id,
      simTime.toISOString(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      simTime.getHours(),
      broadcastPayload,
      entityStatePayload,
    )
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
      patientInstances.push(
        await createPatientInstance(deps, profile, `${profile.name} ${i + 1}号`),
      )
    }
  }

  const state: WardState = {
    id,
    name: config.name,
    speed: clock.speed,
    running: false,
    patientCount: patientInstances.length,
    startedAt: null,
    tick: 0,
  }
  const ward: Ward = { state, clock, patients: patientInstances, profileRefs, db, entityStates: new Map() }

  state.running = true
  state.startedAt = new Date()
  clock.start()
  const existing = wards.get(id)
  if (existing) {
    clearWardInterval(existing)
  }
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

export async function injectScenario(wardId: string, type: ScenarioType): Promise<boolean> {
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
        {
          patientId: pt,
          deviceId: dev,
          kind: 'observation',
          metric: 'bed_status',
          value: 0,
          unit: null,
          tags: { simulated: true, scenario: 'demo_exit', status: 'empty' },
          recordedAt: now,
        },
        {
          patientId: pt,
          deviceId: dev,
          kind: 'alert',
          metric: 'bed_exit',
          value: null,
          unit: null,
          severity: 'warning',
          status: 'active',
          tags: { simulated: true, scenario: 'demo', message: '患者离床' },
          recordedAt: now,
        },
      )
    } else if (type === 'tachycardia') {
      rows.push(
        {
          patientId: pt,
          deviceId: dev,
          kind: 'observation',
          metric: 'heart_rate',
          value: 155,
          unit: 'bpm',
          tags: { simulated: true, scenario: 'demo' },
          recordedAt: now,
        },
        {
          patientId: pt,
          deviceId: dev,
          kind: 'alert',
          metric: 'heart_rate',
          value: 155,
          unit: 'bpm',
          severity: 'critical',
          status: 'active',
          tags: { simulated: true, scenario: 'demo', message: '心动过速' },
          recordedAt: now,
        },
      )
    } else if (type === 'fall') {
      rows.push(
        {
          patientId: pt,
          deviceId: dev,
          kind: 'observation',
          metric: 'fall_detected',
          value: 1,
          unit: null,
          tags: { simulated: true, scenario: 'demo' },
          recordedAt: now,
        },
        {
          patientId: pt,
          deviceId: dev,
          kind: 'alert',
          metric: 'fall_detected',
          value: 1,
          unit: null,
          severity: 'critical',
          status: 'active',
          tags: { simulated: true, scenario: 'demo', message: '跌倒检测' },
          recordedAt: now,
        },
      )
    } else if (type === 'low_spo2') {
      rows.push(
        {
          patientId: pt,
          deviceId: dev,
          kind: 'observation',
          metric: 'spo2',
          value: 87,
          unit: '%',
          tags: { simulated: true, scenario: 'demo' },
          recordedAt: now,
        },
        {
          patientId: pt,
          deviceId: dev,
          kind: 'alert',
          metric: 'spo2',
          value: 87,
          unit: '%',
          severity: 'critical',
          status: 'active',
          tags: { simulated: true, scenario: 'demo', message: '低血氧' },
          recordedAt: now,
        },
      )
    } else if (type === 'hyperglycemia') {
      rows.push(
        {
          patientId: pt,
          deviceId: dev,
          kind: 'observation',
          metric: 'glucose',
          value: 14,
          unit: 'mmol/L',
          tags: { simulated: true, scenario: 'demo' },
          recordedAt: now,
        },
        {
          patientId: pt,
          deviceId: dev,
          kind: 'alert',
          metric: 'glucose',
          value: 14,
          unit: 'mmol/L',
          severity: 'critical',
          status: 'active',
          tags: { simulated: true, scenario: 'demo', message: '高血糖危象' },
          recordedAt: now,
        },
      )
    } else if (type === 'hypoglycemia') {
      rows.push(
        {
          patientId: pt,
          deviceId: dev,
          kind: 'observation',
          metric: 'glucose',
          value: 2.8,
          unit: 'mmol/L',
          tags: { simulated: true, scenario: 'demo' },
          recordedAt: now,
        },
        {
          patientId: pt,
          deviceId: dev,
          kind: 'alert',
          metric: 'glucose',
          value: 2.8,
          unit: 'mmol/L',
          severity: 'critical',
          status: 'active',
          tags: { simulated: true, scenario: 'demo', message: '低血糖危象' },
          recordedAt: now,
        },
      )
    } else if (type === 'hypotension') {
      rows.push(
        {
          patientId: pt,
          deviceId: dev,
          kind: 'observation',
          metric: 'systolic_bp',
          value: 80,
          unit: 'mmHg',
          tags: { simulated: true, scenario: 'demo' },
          recordedAt: now,
        },
        {
          patientId: pt,
          deviceId: dev,
          kind: 'observation',
          metric: 'diastolic_bp',
          value: 50,
          unit: 'mmHg',
          tags: { simulated: true, scenario: 'demo' },
          recordedAt: now,
        },
        {
          patientId: pt,
          deviceId: dev,
          kind: 'alert',
          metric: 'systolic_bp',
          value: 80,
          unit: 'mmHg',
          severity: 'warning',
          status: 'active',
          tags: { simulated: true, scenario: 'demo', message: '低血压' },
          recordedAt: now,
        },
      )
    } else if (type === 'arrhythmia') {
      rows.push(
        {
          patientId: pt,
          deviceId: dev,
          kind: 'observation',
          metric: 'heart_rate',
          value: 185,
          unit: 'bpm',
          tags: { simulated: true, scenario: 'demo', irregular: true },
          recordedAt: now,
        },
        {
          patientId: pt,
          deviceId: dev,
          kind: 'alert',
          metric: 'heart_rate',
          value: 185,
          unit: 'bpm',
          severity: 'critical',
          status: 'active',
          tags: { simulated: true, scenario: 'demo', message: '心律失常' },
          recordedAt: now,
        },
      )
    } else if (type === 'respiratory_distress') {
      rows.push(
        {
          patientId: pt,
          deviceId: dev,
          kind: 'observation',
          metric: 'resp_rate',
          value: 40,
          unit: 'rpm',
          tags: { simulated: true, scenario: 'demo' },
          recordedAt: now,
        },
        {
          patientId: pt,
          deviceId: dev,
          kind: 'observation',
          metric: 'spo2',
          value: 85,
          unit: '%',
          tags: { simulated: true, scenario: 'demo' },
          recordedAt: now,
        },
        {
          patientId: pt,
          deviceId: dev,
          kind: 'alert',
          metric: 'spo2',
          value: 85,
          unit: '%',
          severity: 'critical',
          status: 'active',
          tags: { simulated: true, scenario: 'demo', message: '呼吸窘迫' },
          recordedAt: now,
        },
      )
    }
  }

  if (rows.length > 0) {
    await ward.db.insert(events).values(rows)

    const broadcastPayload = rows.map((r: any) => ({
      patientId: r.patientId,
      deviceId: r.deviceId,
      kind: r.kind,
      metric: r.metric,
      value: r.value,
      unit: r.unit ?? null,
      severity: r.severity ?? null,
      status: r.status ?? null,
      tags: r.tags ?? {},
      recordedAt: r.recordedAt.toISOString(),
    }))
    const simTime = ward.clock.simulatedTime
    broadcastManager.broadcast(
      wardId,
      simTime.toISOString(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      simTime.getHours(),
      broadcastPayload,
      [],
    )
  }
  return true
}
