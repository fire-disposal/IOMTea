import type { DbClient } from '../core/db'
import { events } from '../core/db/schema'
import { simConfigs, simPatients } from '../core/db/schema/sim'
import { usersPin } from '../core/db/schema/pin'
import { eq, and } from 'drizzle-orm'
import { profiles } from './profiles'
import * as phys from './physiology'
import { MetricScheduler } from './scheduler'
import type { Profile, SimStatus } from './types'

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
  profile: Profile
  metrics: { name: string; config: any; enabled: boolean }[]
  patients: Map<string, PatientRunner>
  running: boolean
}

const simulations = new Map<string, Simulation>()
const patientSimMap = new Map<string, string>()
let globalSpeed = 1

type GeneratorFn = (baseline: { mean: number; std: number }, hour: number) => number | string

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

function applyOverrides(metric: any, overrides?: Record<string, { intervalMin: number; intervalMax: number; jitter: number }>) {
  const ov = overrides?.[metric.metric]
  if (ov) return { ...metric, interval: { min: ov.intervalMin, max: ov.intervalMax }, jitter: ov.jitter }
  return metric
}

function startPatientRunner(dbc: DbClient, sim: Simulation, patientId: string, patientName: string, userId?: string) {
  const scheduler = new MetricScheduler()
  scheduler.setSpeed(globalSpeed)
  const runner: PatientRunner = { patientId, patientName, scheduler, lastValues: {}, tickCount: 0 }
  sim.patients.set(patientId, runner)
  patientSimMap.set(patientId, sim.id)

  const simPin = `sim-${patientId.slice(0, 4)}`
  if (userId) {
    dbc.insert(usersPin).values({ pin: simPin, userId, type: 'simulator', label: `模拟-${patientName}` }).onConflictDoNothing().execute().catch(() => {})
  }
  for (const m of sim.metrics) {
    if (!m.enabled) continue
    const generator = generatorMap[m.config.generator]
    if (!generator) continue
    scheduler.schedule(patientId, m.config, async () => {
      const s = simulations.get(sim.id)
      const r = s?.patients.get(patientId)
      if (!s || !r || !s.running) return
      const baseline = sim.profile.baselines[m.name]
      if (!baseline) return
      const hour = new Date().getHours()
      const value = generator(baseline, hour)
      r.lastValues[m.name] = typeof value === 'number' ? value : 0
      r.tickCount++
      await dbc.insert(events).values({
        patientId, kind: 'observation',
        metric: m.name,
        value: typeof value === 'number' ? value : null,
        unit: m.config.unit || null,
        source: 'simulator',
        pinCode: simPin,
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
  if (runner) { runner.scheduler.destroy(); sim.patients.delete(patientId) }
  patientSimMap.delete(patientId)
}

export function createSim(dbc: DbClient, profileName: string, overrides?: Record<string, { intervalMin: number; intervalMax: number; jitter: number }>, name?: string) {
  const profile = profiles[profileName]
  if (!profile) return null
  const id = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const metrics = profile.metrics.map((m) => ({ name: m.metric, config: applyOverrides(m, overrides), enabled: true }))
  const simName = name || profile.label
  const sim: Simulation = { id, name: simName, profileName, profile, metrics, patients: new Map(), running: true }
  simulations.set(id, sim)
  dbc.insert(simConfigs).values({ id, name: simName, profileName, running: true, metrics }).execute().catch((err) => console.error('sim save failed', err))
  return { id, metrics: sim.metrics.map((m) => ({ name: m.name, enabled: m.enabled, config: m.config })) }
}

export function updateSim(id: string, overrides: Record<string, { intervalMin: number; intervalMax: number; jitter: number }>) {
  const sim = simulations.get(id)
  if (!sim) return false
  for (const m of sim.metrics) {
    const ov = overrides[m.name]
    if (ov) m.config = { ...m.config, interval: { min: ov.intervalMin, max: ov.intervalMax }, jitter: ov.jitter }
  }
  return true
}

export function toggleSim(id: string, running: boolean) {
  const sim = simulations.get(id)
  if (!sim) return false
  sim.running = running
  if (!running) for (const [, r] of sim.patients) r.scheduler.destroy()
  return true
}

export function deleteSim(id: string) {
  const sim = simulations.get(id)
  if (!sim) return false
  for (const pid of sim.patients.keys()) stopPatientRunner(pid)
  simulations.delete(id)
  return true
}

export function renameSim(id: string, name: string) {
  const sim = simulations.get(id)
  if (!sim) return false
  sim.name = name
  return true
}

export function toggleSimMetric(id: string, metricName: string, enabled: boolean) {
  const sim = simulations.get(id)
  if (!sim) return false
  const m = sim.metrics.find((x) => x.name === metricName)
  if (!m) return false
  m.enabled = enabled
  if (!enabled) for (const [, r] of sim.patients) r.scheduler.cancel(r.patientId, m.name)
  return true
}

export function addPatientsToSim(dbc: DbClient, id: string, patients: { id: string; name: string; userId?: string | null }[]) {
  const sim = simulations.get(id)
  if (!sim) return 0
  let added = 0
  for (const p of patients) {
    if (patientSimMap.has(p.id)) continue
    startPatientRunner(dbc, sim, p.id, p.name, p.userId ?? undefined)
    dbc.insert(simPatients).values({ simId: id, patientId: p.id }).execute().catch(() => {})
    added++
  }
  return added
}

export function removePatientsFromSim(id: string, patientIds: string[]) {
  let removed = 0
  for (const pid of patientIds) {
    if (patientSimMap.get(pid) !== id) continue
    stopPatientRunner(pid)
    removed++
  }
  return removed
}

export function setGlobalSpeed(speed: number) {
  globalSpeed = speed
  for (const sim of simulations.values()) {
    for (const runner of sim.patients.values()) runner.scheduler.setSpeed(speed)
  }
}

export function getStatus(): SimStatus[] {
  const result: SimStatus[] = []
  for (const sim of simulations.values()) {
    for (const [pid, runner] of sim.patients) {
      result.push({ patientId: pid, patientName: runner.patientName, simId: sim.id, profile: sim.profileName, running: sim.running, lastValues: runner.lastValues, tickCount: runner.tickCount })
    }
  }
  return result
}

export function getSimulations() {
  return Array.from(simulations.values()).map((s) => ({ id: s.id, name: s.name, profileName: s.profileName, running: s.running, patientCount: s.patients.size, metrics: s.metrics.map((m) => ({ name: m.name, enabled: m.enabled, config: m.config })) }))
}

export function getProfileConfig(profileName: string) {
  return profiles[profileName]?.metrics ?? []
}

export function updateSimMetric(id: string, metricName: string, config: { intervalMin?: number; intervalMax?: number; jitter?: number }) {
  const sim = simulations.get(id)
  if (!sim) return false
  const m = sim.metrics.find((x) => x.name === metricName)
  if (!m) return false
  if (config.intervalMin !== undefined) m.config.interval.min = config.intervalMin
  if (config.intervalMax !== undefined) m.config.interval.max = config.intervalMax
  if (config.jitter !== undefined) m.config.jitter = config.jitter
  return true
}
