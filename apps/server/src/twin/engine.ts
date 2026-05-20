import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import type { DbClient } from '../core/db'
import { events, patients, devices } from '../core/db/schema'
import { broadcastManager } from '../core/realtime/broadcast'
import type { PatientProfile, Posture, SimulatedEvent } from './types'
import { getProfile } from './profiles'
import { generateHeartRate, generateRespiratoryRate, generateTemperature, generateSpO2, generateBedStatus } from './physiology/vitals'
import { generateBloodPressure } from './physiology/blood-pressure'
import { generateGlucose } from './physiology/glucose'
import { generateMotionIndex } from './physiology/motion'
import { generatePosture } from './physiology/posture'
import { generateECGSamples } from './physiology/ecg-waveform'
import { generateRespiratoryWaveform } from './physiology/respiratory-waveform'
import { generatePressureDistribution } from './physiology/pressure-distribution'
import { createActorState, tickActorMovement, type ActorState } from './behavior'
import { enqueueInstruction, processNextInstruction } from './instruction'
import { tickScheduler, formatHourMinute } from './scheduler'
import { findPath } from './pathfinding'
import { createChildLogger } from '../core/lib/logger'


const logger = createChildLogger('twin')

// ── Engine State ──

export interface PatientEngine {
  id: string
  patientId: string
  patientDbId: string
  deviceDbId: string
  name: string
  profile: PatientProfile
  mapId: string | null
  actors: Map<string, ActorState>
  grid: number[][] | null
  navGraph: any | null
  speed: number
  running: boolean
  simTime: Date
  tickCount: number
  intervalId?: ReturnType<typeof setInterval>
  behaviorRules: any[]
}

// ── Engine Registry ──

const engines = new Map<string, PatientEngine>()

export function getEngine(patientId: string): PatientEngine | undefined {
  return engines.get(patientId)
}

export function listEngines(): PatientEngine[] {
  return Array.from(engines.values())
}

// ── Activity level from time-of-day ──

function getActivityLevel(simTime: Date, sleepStart: number, sleepEnd: number, mealTimes: number[]): 'resting' | 'light' | 'moderate' {
  const hour = simTime.getHours()
  if (hour >= sleepStart || hour < sleepEnd) return 'resting'
  if (mealTimes.some((m) => Math.abs(hour - m) <= 1)) return 'moderate'
  return 'light'
}

// ── Create Engine ──

export async function createEngine(
  db: DbClient,
  config: { patientId?: string; profileId: string; name: string; mapId?: string; speed?: number },
): Promise<PatientEngine> {
  const profile = getProfile(config.profileId)

  const [patient] = await db.insert(patients).values({
    name: config.name,
    status: 'active',
    tags: { profileId: profile.id, conditions: profile.conditions, simulated: true },
  }).returning()

  const deviceType = profile.devices[0] || 'simulator'
  const serial = `eng-${config.name.replace(/\s/g, '-').toLowerCase()}-${Date.now()}`
  const [device] = await db.insert(devices).values({
    serialNumber: serial,
    deviceType: deviceType as 'mattress' | 'vision' | 'imu' | 'generic' | 'simulator' | 'custom',
    patientId: patient.id,
    tags: { simulated: true, profileId: profile.id },
  }).returning()

  const actorState = createActorState(`actor-${patient.id}`, 1, 1, null)
  const actors = new Map<string, ActorState>()
  actors.set(actorState.entityId, actorState)

  let grid: number[][] | null = null
  let navGraph = null
  let behaviorRules: any[] = []

  const engine: PatientEngine = {
    id: uuid(),
    patientId: config.patientId || patient.id,
    patientDbId: patient.id,
    deviceDbId: device.id,
    name: config.name,
    profile,
    mapId: config.mapId || null,
    actors,
    grid,
    navGraph,
    speed: config.speed ?? 1,
    running: false,
    simTime: new Date(),
    tickCount: 0,
    behaviorRules,
  }

  engines.set(engine.patientId, engine)
  return engine
}

// ── Reconstruct Engine from existing patient ──

export async function reconstructEngine(
  db: DbClient,
  opts: { patientId: string; name: string; tags?: Record<string, unknown> },
): Promise<PatientEngine> {
  const tags = opts.tags || {}
  const profileId = (tags.profileId as string) || 'elderly-cardiac'
  const profile = getProfile(profileId)

  let [device] = await db.select().from(devices).where(eq(devices.patientId, opts.patientId)).limit(1)
  if (!device) {
    const deviceType = profile.devices[0] || 'simulator'
    const serial = `eng-${opts.name.replace(/\s/g, '-').toLowerCase()}-${Date.now()}`
    const [newDevice] = await db.insert(devices).values({
      serialNumber: serial,
      deviceType: deviceType as 'mattress' | 'vision' | 'imu' | 'generic' | 'simulator' | 'custom',
      patientId: opts.patientId,
      tags: { simulated: true, profileId: profile.id },
    }).returning()
    device = newDevice
  }

  const homeGraph = (tags.homeGraph as any) || {}
  const firstRoomId = homeGraph.rooms?.[0]?.id || null

  const actorState = createActorState(`actor-${opts.patientId}`, 1, 1, firstRoomId)
  const actors = new Map<string, ActorState>()
  actors.set(actorState.entityId, actorState)

  const engine: PatientEngine = {
    id: uuid(),
    patientId: opts.patientId,
    patientDbId: opts.patientId,
    deviceDbId: device.id,
    name: opts.name,
    profile,
    mapId: null,
    actors,
    grid: null,
    navGraph: null,
    speed: 1,
    running: false,
    simTime: new Date(),
    tickCount: 0,
    behaviorRules: [],
  }

  engines.set(engine.patientId, engine)
  return engine
}

// ── Unified Tick ──

async function tickPhysiology(engine: PatientEngine): Promise<SimulatedEvent[]> {
  const b = engine.profile.baseline
  const deviceId = engine.deviceDbId
  const patientDbId = engine.patientDbId
  const hour = engine.simTime.getHours()
  const [sleepStartH] = engine.profile.schedule.sleep.start.split(':').map(Number)
  const [sleepEndH] = engine.profile.schedule.sleep.end.split(':').map(Number)
  const mealTimes = engine.profile.schedule.meals.map((m) => { const [h] = m.time.split(':').map(Number); return h })
  const activity = getActivityLevel(engine.simTime, sleepStartH, sleepEndH, mealTimes)
  const allEvents: SimulatedEvent[] = []
  const now = new Date(engine.simTime)

  const hr = generateHeartRate(b.heartRate.resting, b.heartRate.variability, b.heartRate.circadianFactor, hour, activity, engine.tickCount)
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'heart_rate', value: Math.round(hr), unit: 'bpm', tags: { simulated: true }, recordedAt: now })

  const rr = generateRespiratoryRate(b.respiratoryRate.resting, b.respiratoryRate.variability, activity, hr)
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'resp_rate', value: Math.round(rr), unit: 'rpm', tags: { simulated: true }, recordedAt: now })

  const temp = generateTemperature(b.temperature.resting, b.temperature.variability, hour)
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'temperature', value: Math.round(temp * 10) / 10, unit: '°C', tags: { simulated: true }, recordedAt: now })

  const spo2 = generateSpO2(b.spO2.resting, b.spO2.variability)
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'spo2', value: Math.round(spo2), unit: '%', tags: { simulated: true }, recordedAt: now })

  const bp = generateBloodPressure(b.bloodPressure.systolic, b.bloodPressure.diastolic, b.bloodPressure.variability, hour, activity, hr)
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'systolic_bp', value: bp.systolic, unit: 'mmHg', tags: { simulated: true }, recordedAt: now })
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'diastolic_bp', value: bp.diastolic, unit: 'mmHg', tags: { simulated: true }, recordedAt: now })

  const simMinutes = engine.simTime.getHours() * 60 + engine.simTime.getMinutes()
  const glucose = generateGlucose(b.bloodGlucose.fasting, b.bloodGlucose.variability, b.bloodGlucose.postprandialSpike, hour, engine.profile.schedule.meals, simMinutes)
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'glucose', value: glucose, unit: 'mmol/L', tags: { simulated: true }, recordedAt: now })

  const motion = generateMotionIndex(activity)
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'motion_index', value: motion, unit: 'g', tags: { simulated: true }, recordedAt: now })

  const bed = generateBedStatus(activity, hour, engine.profile.schedule.events)
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'bed_status', value: bed, unit: null, tags: { simulated: true, status: bed === 1 ? 'in_bed' : 'empty' }, recordedAt: now })

  const actor = engine.actors.values().next().value as ActorState | undefined
  const previousPosture: Posture = actor?.posture ?? 'lying'
  const posture = generatePosture(activity, hour, bed, previousPosture)
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'posture', value: null, unit: null, tags: { simulated: true, posture }, recordedAt: now })

  const ecgSamples = generateECGSamples(Math.round(hr))
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'ecg_waveform', value: null, unit: null, tags: { simulated: true, waveform: ecgSamples }, recordedAt: now })

  const respWave = generateRespiratoryWaveform(Math.round(rr))
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'resp_waveform', value: null, unit: null, tags: { simulated: true, waveform: respWave }, recordedAt: now })

  const [wMin, wMax] = engine.profile.demographics.weightRange
  const weight = wMin + Math.random() * (wMax - wMin)
  const pressureGrid = generatePressureDistribution(posture, weight)
  allEvents.push({ patientId: patientDbId, deviceId, kind: 'observation', metric: 'pressure_grid', value: null, unit: null, tags: { simulated: true, grid: pressureGrid, posture }, recordedAt: now })

  return allEvents
}

function tickBehavior(engine: PatientEngine): void {
  if (!engine.navGraph) return

  const scheduled = tickScheduler(
    engine.behaviorRules,
    Array.from(engine.actors.values()).map((a) => ({ entityId: a.entityId, patientId: engine.patientId })),
    formatHourMinute(engine.simTime),
  )

  for (const { actorId, instructions } of scheduled) {
    const actor = engine.actors.get(actorId)
    if (actor) {
      for (const inst of instructions) {
        enqueueInstruction(actor, inst)
      }
    }
  }

  for (const actor of engine.actors.values()) {
    if (actor.behaviorState === 'moving') {
      tickActorMovement(actor, engine.speed)
    }

    if (actor.behaviorState === 'idle' && actor.instructionQueue.length > 0) {
      const next = processNextInstruction(actor)
      if (next && engine.grid) {
        handleInstruction(engine, actor, next)
      }
    }
  }
}

function handleInstruction(engine: PatientEngine, actor: ActorState, instruction: any): void {
  if (!engine.grid || !engine.navGraph) return

  switch (instruction.type) {
    case 'move_to_room': {
      const { room } = instruction.params
      const roomNode = engine.navGraph.rooms.find((r: any) => r.name === room || r.roomId === room)
      if (roomNode) {
        const path = findPath(
          engine.grid.map((row) => row.map((c) => ({ terrain: c as 0 | 1 | 2 }))),
          { x: Math.floor(actor.tileX), y: Math.floor(actor.tileY) },
          roomNode.centroid,
        )
        if (path) {
          actor.behaviorState = 'moving'
          actor.posture = 'walking'
          actor.targetTileX = roomNode.centroid.x
          actor.targetTileY = roomNode.centroid.y
          actor.path = path.path
          actor.pathProgress = 0
          actor.currentRoomId = roomNode.roomId
        }
      }
      break
    }
    case 'change_posture': {
      actor.posture = instruction.params.posture
      break
    }
  }
}

// ── Start / Stop ──

export async function startEngine(db: DbClient, patientId: string): Promise<void> {
  const engine = engines.get(patientId)
  if (!engine || engine.running) return

  engine.running = true

  engine.intervalId = setInterval(async () => {
    if (!engine.running) return
    try {
      engine.simTime = new Date(engine.simTime.getTime() + 1000 * engine.speed)
      engine.tickCount++

      const physEvents = await tickPhysiology(engine)

      tickBehavior(engine)

      if (physEvents.length > 0) {
        const rows = physEvents.map((e) => ({
          patientId: e.patientId,
          deviceId: e.deviceId,
          kind: e.kind,
          metric: e.metric,
          value: e.value,
          unit: e.unit,
          source: 'simulator' as const,
          tags: e.tags,
          recordedAt: e.recordedAt,
        }))
        await db.insert(events).values(rows).catch((err) => { logger.warn({ err }, 'failed to insert simulated events') })
      }

      broadcastManager.broadcastTwin(
        engine.mapId || engine.patientId,
        engine.simTime.toISOString(),
        Array.from(engine.actors.values()).map((a) => ({
          entityId: a.entityId,
          tileX: a.tileX,
          tileY: a.tileY,
          posture: a.posture,
          behaviorState: a.behaviorState,
          currentRoomId: a.currentRoomId,
          pathProgress: a.pathProgress,
        })),
      )
    } catch (err) {
      logger.error({ err }, 'PatientEngine tick error')
    }
  }, 1000)
}

export function stopEngine(patientId: string): void {
  const engine = engines.get(patientId)
  if (!engine) return
  engine.running = false
  if (engine.intervalId) {
    clearInterval(engine.intervalId)
    engine.intervalId = undefined
  }
}

export function setSpeed(patientId: string, speed: number): boolean {
  const engine = engines.get(patientId)
  if (!engine) return false
  engine.speed = Math.max(0.1, Math.min(speed, 60))
  return true
}

export function getEngineStatus(patientId: string) {
  const engine = engines.get(patientId)
  if (!engine) return null
  return {
    id: engine.id,
    patientId: engine.patientId,
    name: engine.name,
    speed: engine.speed,
    running: engine.running,
    simTime: engine.simTime.toISOString(),
    tickCount: engine.tickCount,
    actorCount: engine.actors.size,
    hasMap: !!engine.navGraph,
  }
}

export async function injectScenario(
  db: DbClient,
  patientId: string,
  scenarioType: string,
): Promise<boolean> {
  const engine = engines.get(patientId)
  if (!engine) return false

  const SCENARIOS: Record<string, { observation?: Partial<SimulatedEvent>; alert?: Partial<SimulatedEvent> }> = {
    tachycardia: {
      observation: { metric: 'heart_rate', value: 155, unit: 'bpm' },
      alert: { metric: 'heart_rate', value: 155, unit: 'bpm', kind: 'alert', severity: 'critical', status: 'active' as const },
    },
    low_spo2: {
      observation: { metric: 'spo2', value: 88, unit: '%' },
      alert: { metric: 'spo2', value: 88, unit: '%', kind: 'alert', severity: 'critical', status: 'active' as const },
    },
    hypotension: {
      observation: { metric: 'systolic_bp', value: 85, unit: 'mmHg' },
      alert: { metric: 'systolic_bp', value: 85, unit: 'mmHg', kind: 'alert', severity: 'warning', status: 'active' as const },
    },
    fall: {
      observation: { metric: 'posture', value: null, unit: null },
      alert: { metric: 'fall_detected', value: null, unit: null, kind: 'alert', severity: 'critical', status: 'active' as const, tags: { scenario: 'fall' } },
    },
    bed_exit: {
      observation: { metric: 'bed_status', value: 0, unit: null },
      alert: { metric: 'bed_exit', value: null, unit: null, kind: 'alert', severity: 'warning', status: 'active' as const },
    },
    hyperglycemia: {
      observation: { metric: 'glucose', value: 13.5, unit: 'mmol/L' },
      alert: { metric: 'glucose', value: 13.5, unit: 'mmol/L', kind: 'alert', severity: 'critical', status: 'active' as const },
    },
    hypoglycemia: {
      observation: { metric: 'glucose', value: 2.8, unit: 'mmol/L' },
      alert: { metric: 'glucose', value: 2.8, unit: 'mmol/L', kind: 'alert', severity: 'critical', status: 'active' as const },
    },
    arrhythmia: {
      observation: { metric: 'heart_rate', value: 180, unit: 'bpm' },
      alert: { metric: 'arrhythmia', value: null, unit: null, kind: 'alert', severity: 'critical', status: 'active' as const },
    },
    respiratory_distress: {
      observation: { metric: 'resp_rate', value: 35, unit: 'rpm' },
      alert: { metric: 'resp_rate', value: 35, unit: 'rpm', kind: 'alert', severity: 'critical', status: 'active' as const },
    },
  }

  const scenario = SCENARIOS[scenarioType]
  if (!scenario) return false

  const now = new Date()

  if (scenario.observation) {
    await db.insert(events).values({
      patientId: engine.patientDbId,
      deviceId: engine.deviceDbId,
      kind: 'observation',
      metric: scenario.observation.metric || 'unknown',
      value: scenario.observation.value ?? null,
      unit: scenario.observation.unit || null,
      source: 'manual' as const,
      tags: { scenario: scenarioType, injected: true },
      recordedAt: now,
    }).catch((err) => { logger.warn({ err }, 'failed to insert scenario observation') })
  }

  if (scenario.alert) {
    await db.insert(events).values({
      patientId: engine.patientDbId,
      deviceId: engine.deviceDbId,
      kind: 'alert',
      metric: scenario.alert.metric || 'unknown',
      value: scenario.alert.value ?? null,
      unit: scenario.alert.unit || null,
      severity: scenario.alert.severity || 'warning',
      status: scenario.alert.status || 'active',
      source: 'manual' as const,
      tags: { scenario: scenarioType, injected: true },
      recordedAt: now,
    }).catch((err) => { logger.warn({ err }, 'failed to insert scenario alert') })
  }

  return true
}
