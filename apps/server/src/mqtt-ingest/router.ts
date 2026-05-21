import { db } from '../core/db'
import { usersPin } from '../core/db/schema/pin'
import { events, patients } from '../core/db/schema'
import { eq } from 'drizzle-orm'
import mqtt from 'mqtt'

const METRIC_ALIASES: Record<string, string> = {
  hr: 'heart_rate',
  pulse: 'heart_rate',
  heartrate: 'heart_rate',
  heartbeat: 'heart_rate',
  glucose: 'blood_glucose',
  blood_glucose: 'blood_glucose',
  spo2: 'spo2',
  blood_oxygen: 'spo2',
  temp: 'temperature',
  body_temperature: 'temperature',
  weight: 'weight',
  systolic_bp: 'systolic_bp',
  diastolic_bp: 'diastolic_bp',
}

const DEFAULT_UNITS: Record<string, string> = {
  heart_rate: 'bpm',
  blood_glucose: 'mg/dL',
  spo2: '%',
  temperature: '°C',
  weight: 'kg',
  systolic_bp: 'mmHg',
  diastolic_bp: 'mmHg',
}

const METRIC_RANGES: Record<string, { min: number; max: number }> = {
  heart_rate: { min: 20, max: 260 },
  blood_glucose: { min: 20, max: 800 },
  spo2: { min: 40, max: 100 },
  temperature: { min: 30, max: 45 },
  weight: { min: 1, max: 400 },
  systolic_bp: { min: 50, max: 280 },
  diastolic_bp: { min: 30, max: 180 },
}

export function normalizeMetric(rawMetric: unknown): string | null {
  if (typeof rawMetric !== 'string') return null
  const normalized = rawMetric.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!normalized) return null
  const metric = METRIC_ALIASES[normalized] ?? normalized
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(metric)) return null
  return metric
}

function asFiniteNumber(raw: unknown): number | null {
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
  return DEFAULT_UNITS[metric]
}

function isValueInRange(metric: string, value: number): boolean {
  const range = METRIC_RANGES[metric]
  if (!range) return true
  return value >= range.min && value <= range.max
}

export function parseHealthPayload(body: Record<string, unknown>) {
  const metric = normalizeMetric(body.metric)
  if (!metric) return null

  const value = asFiniteNumber(body.value)
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

async function resolvePatientId(userId: string): Promise<string | null> {
  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.userId, userId))
    .orderBy(patients.createdAt)
    .limit(1)
  return patient?.id ?? null
}

async function handleHealthEvent(pin: string, topicSource: string, routeType: string, body: Record<string, unknown>): Promise<void> {
  const normalized = parseHealthPayload(body)
  if (!normalized) return

  const [pinRecord] = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
  if (!pinRecord) return

  const patientId = await resolvePatientId(pinRecord.userId)
  if (!patientId) return

  const tags: Record<string, unknown> = {
    topicSource,
    routeType,
    payloadSource: normalized.payloadSource ?? null,
  }
  if (pinRecord.thingId) tags.thingId = pinRecord.thingId

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
  body: Record<string, unknown>
): Promise<void> {
  if (action === 'verify') {
    const [record] = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
    const response = {
      pin,
      valid: !!record,
      userId: record?.userId ?? null,
      nickname: record?.nickname ?? '',
      requestId: body.requestId as string ?? '',
    }
    client.publish(
      `iomtea/admin/pin/verify/${pin}/result`,
      JSON.stringify(response),
      { qos: 1 },
      (err) => {
        if (err) console.error('[mqtt-admin] publish error:', err)
      }
    )
  }
}

export async function routeMessage(
  topic: string,
  payload: Buffer,
  client?: mqtt.MqttClient,
): Promise<void> {
  const parts = topic.split('/')
  if (parts.length < 4 || parts[0] !== 'users') return

  const pin = parts[1]
  if (!/^\d{4,6}$/.test(pin)) return

  const topicSource = parts[2]
  const routeType = parts[3] ?? ''
  if (!routeType) return

  let body: Record<string, unknown>
  try {
    const parsed = JSON.parse(payload.toString())
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
    body = parsed as Record<string, unknown>
  } catch {
    return
  }

  if (topicSource === 'admin' && client) {
    await handleAdminMessage(client, pin, routeType, body)
    return
  }

  await handleHealthEvent(pin, topicSource, routeType, body)
}
