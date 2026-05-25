import type { DbClient } from '../../core/db'
import { events } from '../../core/db/schema.js'
import { simConfigs, simPatients } from './schema.js'
import { eq } from 'drizzle-orm'
import { profiles, getProfile, listProfiles } from './profiles.js'
import * as phys from '../../core/pipeline/physiology.js'
import { MetricScheduler } from './scheduler.js'
import type { UnifiedProfile, MetricConfig } from './profiles.js'

interface PatientRunner {
  patientId: string
  patientName: string
  scheduler: MetricScheduler
  lastValues: Record<string, number>
  tickCount: number
}

interface Simulation {
  id: string
  name: string
  profileName: string
  profile: UnifiedProfile
  metrics: { name: string; config: MetricConfig; enabled: boolean }[]
  patients: Map<string, PatientRunner>
  running: boolean
  speed: number
}

const simulations = new Map<string, Simulation>()
const patientSimMap = new Map<string, string>()
let globalSpeed = 1

type GeneratorFn = (baseline: { mean: number; std: number }, hour: number) => number | string

const generatorMap: Record<string, GeneratorFn> = {
  heartRate: phys.generateHeartRate,
  spo2: phys.generateSpO2,
  temperature: phys.generateTemperature,
  systolicBp: phys.generateSystolicBp,
  diastolicBp: phys.generateDiastolicBp,
  glucose: phys.generateGlucose,
  respiratoryRate: phys.generateRespiratoryRate,
  posture: (_baseline, _hour) => phys.generatePosture(),
  bedStatus: (_baseline, _hour) => phys.generateBedStatus(),
  motionIndex: (_baseline, _hour) => phys.generateMotionIndex(),
}

function baselineKey(metric: string): keyof typeof profiles['elderly-cardiac']['baselines'] | null {
  const map: Record<string, keyof typeof profiles['elderly-cardiac']['baselines']> = {
    heart_rate: 'heartRate',
    spo2: 'spo2',
    temperature: 'temperature',
    systolic_bp: 'systolicBp',
    diastolic_bp: 'diastolicBp',
    glucose: 'glucose',
    resp_rate: 'respiratoryRate',
  }
  return map[metric] ?? null
}

function startPatientRunner(dbc: DbClient, sim: Simulation, patientId: string, patientName: string) {
  const scheduler = new MetricScheduler()
  scheduler.setSpeed(sim.speed * globalSpeed)
  const runner: PatientRunner = { patientId, patientName, scheduler, lastValues: {}, tickCount: 0 }
  sim.patients.set(patientId, runner)
  patientSimMap.set(patientId, sim.id)

  for (const m of sim.metrics) {
    if (!m.enabled) continue
    const generator = generatorMap[m.config.generator]
    if (!generator) continue
    scheduler.schedule(patientId, m.config, async () => {
      const s = simulations.get(sim.id)
      const r = s?.patients.get(patientId)
      if (!s || !r || !s.running) return
      const bk = baselineKey(m.name)
      if (!bk) return
      const baseline = sim.profile.baselines[bk]
      if (!baseline) return
      const hour = new Date().getHours()
      const value = generator(baseline, hour)
      r.lastValues[m.name] = typeof value === 'number' ? value : 0
      r.tickCount++
      await dbc.insert(events).values({
        patientId,
        kind: 'observation',
        metric: m.name,
        value: typeof value === 'number' ? value : null,
        unit: m.config.unit || null,
        source: 'simulator',
        recordedAt: new Date(),
        tags: { sim: true, simId: sim.id, profile: sim.profileName },
      } as any)
    })
  }
}

function stopPatientRunner(patientId: string) {
  const simId = patientSimMap.get(patientId)
  if (!simId) return
  const sim = simulations.get(simId)
  if (!sim) return
  const runner = sim.patients.get(patientId)
  if (runner) {
    runner.scheduler.destroy()
    sim.patients.delete(patientId)
  }
  patientSimMap.delete(patientId)
}

export function createSimulation(
  db: DbClient,
  config: { profileName: string; name?: string },
) {
  const profile = profiles[config.profileName]
  if (!profile) return null
  const id = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const metrics = profile.metrics.map((m) => ({
    name: m.metric,
    config: { ...m },
    enabled: true,
  }))
  const simName = config.name || profile.displayName
  const sim: Simulation = {
    id,
    name: simName,
    profileName: config.profileName,
    profile,
    metrics,
    patients: new Map(),
    running: false,
    speed: 1,
  }
  simulations.set(id, sim)
  db
    .insert(simConfigs)
    .values({ id, name: simName, profileName: config.profileName, running: false, speed: 1, metrics: metrics as any } as any)
    .execute()
    .catch((err: Error) => console.error('sim save failed', err))
  return { id, metrics: sim.metrics.map((m) => ({ name: m.name, enabled: m.enabled, config: m.config })) }
}

export function deleteSimulation(db: DbClient, id: string): boolean {
  const sim = simulations.get(id)
  if (!sim) return false
  for (const pid of sim.patients.keys()) stopPatientRunner(pid)
  simulations.delete(id)
  db.delete(simConfigs).where(eq(simConfigs.id, id)).execute().catch(() => {})
  return true
}

export function toggleSimulation(db: DbClient, id: string, running: boolean): boolean {
  const sim = simulations.get(id)
  if (!sim) return false
  sim.running = running
  if (!running) for (const [, r] of sim.patients) r.scheduler.destroy()
  db.update(simConfigs).set({ running } as any).where(eq(simConfigs.id, id)).execute().catch(() => {})
  return true
}

export function setSpeed(speed: number) {
  globalSpeed = speed
  for (const sim of simulations.values()) {
    for (const runner of sim.patients.values()) runner.scheduler.setSpeed(speed * sim.speed)
  }
}

export function addPatient(
  db: DbClient,
  simId: string,
  patient: { id: string; name: string },
): number {
  const sim = simulations.get(simId)
  if (!sim) return 0
  if (patientSimMap.has(patient.id)) return 0
  startPatientRunner(db, sim, patient.id, patient.name)
  db
    .insert(simPatients)
    .values({ simId, patientId: patient.id } as any)
    .execute()
    .catch(() => {})
  return 1
}

export function removePatient(db: DbClient, simId: string, patientId: string): number {
  if (patientSimMap.get(patientId) !== simId) return 0
  stopPatientRunner(patientId)
  db
    .delete(simPatients)
    .where(eq(simPatients.patientId, patientId) as any)
    .execute()
    .catch(() => {})
  return 1
}

export function getSimulations() {
  return Array.from(simulations.values()).map((s) => ({
    id: s.id,
    name: s.name,
    profileName: s.profileName,
    running: s.running,
    patientCount: s.patients.size,
    metrics: s.metrics.map((m) => ({ name: m.name, enabled: m.enabled, config: m.config })),
  }))
}

export function getSimulation(id: string) {
  const s = simulations.get(id)
  if (!s) return null
  return {
    id: s.id,
    name: s.name,
    profileName: s.profileName,
    running: s.running,
    patientCount: s.patients.size,
    metrics: s.metrics.map((m) => ({ name: m.name, enabled: m.enabled, config: m.config })),
  }
}

export function getProfiles() {
  return listProfiles()
}

export function getProfileConfig(name: string) {
  const p = profiles[name]
  return p?.metrics ?? []
}

export function toggleMetric(
  db: DbClient,
  simId: string,
  metric: string,
  enabled: boolean,
): boolean {
  const sim = simulations.get(simId)
  if (!sim) return false
  const m = sim.metrics.find((x) => x.name === metric)
  if (!m) return false
  m.enabled = enabled
  if (!enabled) for (const [, r] of sim.patients) r.scheduler.cancel(r.patientId, m.name)
  return true
}

export function updateMetric(
  db: DbClient,
  simId: string,
  metric: string,
  config: { intervalMin?: number; intervalMax?: number; jitter?: number },
): boolean {
  const sim = simulations.get(simId)
  if (!sim) return false
  const m = sim.metrics.find((x) => x.name === metric)
  if (!m) return false
  if (config.intervalMin !== undefined) m.config.interval.min = config.intervalMin
  if (config.intervalMax !== undefined) m.config.interval.max = config.intervalMax
  if (config.jitter !== undefined) m.config.jitter = config.jitter
  return true
}

export function renameSim(db: DbClient, simId: string, name: string): boolean {
  const sim = simulations.get(simId)
  if (!sim) return false
  sim.name = name
  db.update(simConfigs).set({ name } as any).where(eq(simConfigs.id, simId)).execute().catch(() => {})
  return true
}

export function injectScenario(
  db: DbClient,
  simId: string,
  patientId: string,
  type: string,
): boolean {
  const sim = simulations.get(simId)
  if (!sim) return false

  const SCENARIOS: Record<
    string,
    { observation?: Record<string, unknown>; alert?: Record<string, unknown> }
  > = {
    tachycardia: {
      observation: { metric: 'heart_rate', value: 155, unit: 'bpm' },
      alert: { metric: 'heart_rate', value: 155, unit: 'bpm', kind: 'alert', severity: 'critical', status: 'active' },
    },
    low_spo2: {
      observation: { metric: 'spo2', value: 88, unit: '%' },
      alert: { metric: 'spo2', value: 88, unit: '%', kind: 'alert', severity: 'critical', status: 'active' },
    },
    hypotension: {
      observation: { metric: 'systolic_bp', value: 85, unit: 'mmHg' },
      alert: { metric: 'systolic_bp', value: 85, unit: 'mmHg', kind: 'alert', severity: 'warning', status: 'active' },
    },
    fall: {
      observation: { metric: 'posture', value: null, unit: null },
      alert: { metric: 'fall_detected', value: null, unit: null, kind: 'alert', severity: 'critical', status: 'active', tags: { scenario: 'fall' } },
    },
    bed_exit: {
      observation: { metric: 'bed_status', value: 0, unit: null },
      alert: { metric: 'bed_exit', value: null, unit: null, kind: 'alert', severity: 'warning', status: 'active' },
    },
    hyperglycemia: {
      observation: { metric: 'glucose', value: 13.5, unit: 'mmol/L' },
      alert: { metric: 'glucose', value: 13.5, unit: 'mmol/L', kind: 'alert', severity: 'critical', status: 'active' },
    },
    hypoglycemia: {
      observation: { metric: 'glucose', value: 2.8, unit: 'mmol/L' },
      alert: { metric: 'glucose', value: 2.8, unit: 'mmol/L', kind: 'alert', severity: 'critical', status: 'active' },
    },
    arrhythmia: {
      observation: { metric: 'heart_rate', value: 180, unit: 'bpm' },
      alert: { metric: 'arrhythmia', value: null, unit: null, kind: 'alert', severity: 'critical', status: 'active' },
    },
    respiratory_distress: {
      observation: { metric: 'resp_rate', value: 35, unit: 'rpm' },
      alert: { metric: 'resp_rate', value: 35, unit: 'rpm', kind: 'alert', severity: 'critical', status: 'active' },
    },
  }

  const scenario = SCENARIOS[type]
  if (!scenario) return false

  const now = new Date()

  if (scenario.observation) {
    db
      .insert(events)
      .values({
        patientId,
        kind: 'observation',
        metric: scenario.observation.metric as string || 'unknown',
        value: scenario.observation.value as any ?? null,
        unit: (scenario.observation.unit as string) || null,
        source: 'manual',
        tags: { scenario: type, injected: true },
        recordedAt: now,
      } as any)
      .execute()
      .catch(() => {})
  }

  if (scenario.alert) {
    db
      .insert(events)
      .values({
        patientId,
        kind: 'alert',
        metric: (scenario.alert.metric as string) || 'unknown',
        value: scenario.alert.value as any ?? null,
        unit: (scenario.alert.unit as string) || null,
        severity: (scenario.alert.severity as string) || 'warning',
        status: (scenario.alert.status as string) || 'active',
        source: 'manual',
        tags: { scenario: type, injected: true, ...((scenario.alert.tags as Record<string, unknown>) || {}) },
        recordedAt: now,
      } as any)
      .execute()
      .catch(() => {})
  }

  return true
}
