import { db } from '../core/db'
import { usersPin } from '../core/db/schema/pin'
import { events, patients } from '../core/db/schema.js'
import { userPatientLinks } from '../core/db/schema/user-patient'
import { eq, inArray } from 'drizzle-orm'
import mqtt from 'mqtt'
import { broadcastManager } from '../core/realtime/broadcast'
import { createChildLogger } from '../core/lib/logger'
import { normalizeMetric as sharedNormalize, getMetricUnit } from '../core/lib/metrics'

const logger = createChildLogger('mqtt-router')

async function handleDeviceEvent(topicId: string, body: Record<string, unknown>): Promise<void> {
  const pin = body.pin as string | undefined
  if (!pin || pin.length < 4) {
    logger.debug({ topicId }, '设备事件无有效 PIN，跳过')
    return
  }

  const [pinRecord] = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
  if (!pinRecord) {
    logger.debug({ pin }, 'PIN 未注册，跳过设备事件')
    return
  }

  const [patient] = await db.select({ id: patients.id }).from(patients).innerJoin(userPatientLinks, eq(userPatientLinks.patientId, patients.id)).where(eq(userPatientLinks.userId, pinRecord.userId)).limit(1)
  if (!patient) {
    logger.debug({ pin, userId: pinRecord.userId }, 'PIN 未关联患者，跳过')
    return
  }

  const event = body.event as string
  const metric = body.metric as string
  const value = body.value !== undefined ? Number(body.value) : null

  if (event === 'healthObservation' || event === 'healthAlert') {
    if (!metric) return
    const normalizedMetric = sharedNormalize(metric)
    if (!normalizedMetric) return
    const numValue = value !== null ? value : NaN
    if (isNaN(numValue)) return

    const kind = event === 'healthAlert' ? 'alert' : 'observation'
    await db.insert(events).values({
      patientId: patient.id,
      pinCode: pin,
      kind,
      metric: normalizedMetric,
      value: numValue,
      unit: (body.unit as string) || getMetricUnit(normalizedMetric),
      source: 'iot',
      severity: event === 'healthAlert' ? ((body.severity as any) || 'warning') : undefined,
      status: event === 'healthAlert' ? 'active' : undefined,
      tags: { deviceId: body.deviceId, ...(body.metadata as any || {}) },
      recordedAt: new Date(),
    } as any).catch((err) => { logger.warn({ err, metric }, '设备事件写入失败') })

    broadcastManager.broadcastVitals(patient.id, [{
      metric,
      value: numValue,
      unit: body.unit as string | null ?? null,
    }])
  } else if (event === 'fallDetected') {
    await db.insert(events).values({
      patientId: patient.id,
      pinCode: pin,
      kind: 'alert',
      metric: 'fall_detected',
      value: null,
      severity: 'critical',
      status: 'active',
      source: 'iot',
      tags: { deviceId: body.deviceId, confidence: body.confidence, ...(body.metadata as any || {}) },
      recordedAt: new Date(),
    } as any).catch((err) => { logger.warn({ err }, 'fall_detected 事件写入失败') })
  }

  await db.update(usersPin).set({ lastSeenAt: new Date() }).where(eq(usersPin.pin, pin))
}

const TOPIC_ROOT_SEGMENT = 'users'
const PIN_PATTERN = /^\d{4,6}$/
const METRIC_PATTERN = /^[a-z][a-z0-9_]{1,63}$/

const CANONICAL_METRICS = [
  'heart_rate',
  'glucose',
  'spo2',
  'temperature',
  'weight',
  'systolic_bp',
  'diastolic_bp',
] as const
type CanonicalMetric = (typeof CANONICAL_METRICS)[number]

const METRIC_ALIASES: Record<string, CanonicalMetric> = {
  hr: 'heart_rate', pulse: 'heart_rate', heartrate: 'heart_rate', heartbeat: 'heart_rate',
  glucose: 'glucose', blood_glucose: 'glucose', blood_sugar: 'glucose', bg: 'glucose',
  spo2: 'spo2', blood_oxygen: 'spo2',
  temp: 'temperature', body_temperature: 'temperature', body_temp: 'temperature',
  weight: 'weight', body_weight: 'weight',
  systolic_bp: 'systolic_bp', sbp: 'systolic_bp',
  diastolic_bp: 'diastolic_bp', dbp: 'diastolic_bp',
}

const DEFAULT_UNITS: Record<CanonicalMetric, string> = {
  heart_rate: 'bpm', glucose: 'mmol/L', spo2: '%',
  temperature: '°C', weight: 'kg', systolic_bp: 'mmHg', diastolic_bp: 'mmHg',
}

const METRIC_RANGES: Partial<Record<CanonicalMetric, { min: number; max: number }>> = {
  heart_rate: { min: 20, max: 260 }, glucose: { min: 0.5, max: 35 },
  spo2: { min: 40, max: 100 }, temperature: { min: 30, max: 45 },
  weight: { min: 1, max: 500 }, systolic_bp: { min: 40, max: 280 }, diastolic_bp: { min: 20, max: 180 },
}

function isCanonicalMetric(metric: string): metric is CanonicalMetric {
  return (CANONICAL_METRICS as readonly string[]).includes(metric)
}

export function normalizeMetric(rawMetric: unknown): string | null {
  if (typeof rawMetric !== 'string') return null
  const normalized = rawMetric
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (!normalized) return null
  const metric = METRIC_ALIASES[normalized] ?? normalized
  if (!METRIC_PATTERN.test(metric)) return null
  return metric
}

function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeRecordedAt(raw: unknown): Date {
  if (typeof raw !== 'string' || raw.trim() === '') return new Date()
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return new Date()
  return parsed
}

function resolveUnit(metric: string, rawUnit: unknown): string | undefined {
  if (typeof rawUnit === 'string' && rawUnit.trim() !== '') return rawUnit.trim()
  return isCanonicalMetric(metric) ? DEFAULT_UNITS[metric] : undefined
}

function isValueInRange(metric: string, value: number): boolean {
  const range = isCanonicalMetric(metric) ? METRIC_RANGES[metric] : undefined
  if (!range) return true
  return value >= range.min && value <= range.max
}

export function parseHealthPayload(body: Record<string, unknown>) {
  const metric = normalizeMetric(body.metric)
  if (!metric) return null

  const value = toFiniteNumber(body.value)
  if (value === null) return null
  if (!isValueInRange(metric, value)) return null

  return {
    metric,
    value,
    unit: resolveUnit(metric, body.unit),
    recordedAt: normalizeRecordedAt(body.recordedAt),
    payloadSource: typeof body.source === 'string' ? body.source : undefined,
  }
}

function parsePayloadObject(payload: Buffer): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(payload.toString())
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function parseTopic(topic: string): { pin: string; topicSource: string; routeType: string } | null {
  const parts = topic.split('/')
  if (parts.length < 4 || parts[0] !== TOPIC_ROOT_SEGMENT) return null

  const pin = parts[1]
  if (!PIN_PATTERN.test(pin)) return null

  const topicSource = parts[2]
  const routeType = parts[3] ?? ''
  if (!routeType) return null

  return { pin, topicSource, routeType }
}

async function resolvePatientId(userId: string): Promise<string | null> {
  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .innerJoin(userPatientLinks, eq(userPatientLinks.patientId, patients.id))
    .where(eq(userPatientLinks.userId, userId))
    .orderBy(userPatientLinks.createdAt)
    .limit(1)
  return patient?.id ?? null
}

function buildEventTags(
  topicSource: string,
  routeType: string,
  payloadSource: string | undefined,
): Record<string, unknown> {
  const tags: Record<string, unknown> = {
    topicSource,
    routeType,
    payloadSource: payloadSource ?? null,
  }

  return tags
}

async function handleHealthEvent(
  pin: string,
  topicSource: string,
  routeType: string,
  body: Record<string, unknown>,
): Promise<void> {
  const normalized = parseHealthPayload(body)
  if (!normalized) return

  const [pinRecord] = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
  if (!pinRecord) return

  const patientId = await resolvePatientId(pinRecord.userId)
  if (!patientId) return

  const tags = buildEventTags(topicSource, routeType, normalized.payloadSource)

  await db.insert(events).values({
    patientId,
    pinCode: pin,
    kind: 'observation',
    metric: normalized.metric,
    value: normalized.value,
    unit: normalized.unit,
    source: 'iot',
    tags,
    recordedAt: normalized.recordedAt,
  })

  await db.update(usersPin).set({ lastSeenAt: new Date() }).where(eq(usersPin.pin, pin))
}

async function handleAdminMessage(
  client: mqtt.MqttClient,
  pin: string,
  action: string,
  body: Record<string, unknown>,
): Promise<void> {
  if (action === 'verify') {
    const [record] = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
    const response = {
      pin,
      valid: !!record,
      userId: record?.userId ?? null,
      nickname: record?.nickname ?? '',
      requestId: (body.requestId as string) ?? '',
    }
    client.publish(
      `iomtea/admin/pin/verify/${pin}/result`,
      JSON.stringify(response),
      { qos: 1 },
      (err) => {
        if (err) console.error('[mqtt-admin] publish error:', err)
      },
    )
  }
}

export async function routeMessage(
  topic: string,
  payload: Buffer,
  client?: mqtt.MqttClient,
): Promise<void> {
  const parts = topic.split('/')

  if (parts[0] === 'iomtea' && parts[1] === 'device' && parts.length >= 4 && parts[3] === 'events') {
    const topicId = parts[2]
    const body = parsePayloadObject(payload)
    if (!body) return
    await handleDeviceEvent(topicId, body)
    return
  }

  const parsedTopic = parseTopic(topic)
  if (!parsedTopic) return
  const { pin, topicSource, routeType } = parsedTopic

  const body = parsePayloadObject(payload)
  if (!body) return

  if (topicSource === 'admin' && client) {
    await handleAdminMessage(client, pin, routeType, body)
    return
  }

  await handleHealthEvent(pin, topicSource, routeType, body)
}
