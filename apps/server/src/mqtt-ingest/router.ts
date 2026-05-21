import { db } from '../core/db'
import { usersPin } from '../core/db/schema/pin'
import { events, patients } from '../core/db/schema'
import { eq } from 'drizzle-orm'
import mqtt from 'mqtt'
import { broadcastManager } from '../core/realtime/broadcast'
import { createChildLogger } from '../core/lib/logger'

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

  const [patient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.userId, pinRecord.userId)).limit(1)
  if (!patient) {
    logger.debug({ pin, userId: pinRecord.userId }, 'PIN 未关联患者，跳过')
    return
  }

  const event = body.event as string
  const metric = body.metric as string
  const value = body.value !== undefined ? Number(body.value) : null

  if (event === 'healthObservation' || event === 'healthAlert') {
    if (!metric) return
    const numValue = value !== null ? value : NaN
    if (isNaN(numValue)) return

    const kind = event === 'healthAlert' ? 'alert' : 'observation'
    await db.insert(events).values({
      patientId: patient.id,
      pinCode: pin,
      kind,
      metric,
      value: numValue,
      unit: body.unit as string | undefined,
      source: (body.source as any) || 'simulator',
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

async function handleHealthEvent(pin: string, body: Record<string, unknown>): Promise<void> {
  if (!body.metric || body.value === undefined) return

  const [pinRecord] = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
  if (!pinRecord) return

  const numValue = Number(body.value)
  if (isNaN(numValue)) return

  const tags: Record<string, unknown> = { topicSource: body.source as string ?? 'iot' }
  if (pinRecord.thingId) tags.thingId = pinRecord.thingId

  await db.insert(events).values({
    patientId: pinRecord.userId,
    pinCode: pin,
    kind: 'observation',
    metric: String(body.metric),
    value: numValue,
    unit: body.unit ? String(body.unit) : undefined,
    source: 'iot',
    tags,
    recordedAt: body.recordedAt ? new Date(body.recordedAt as string) : new Date(),
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

  if (parts[0] === 'iomtea' && parts[1] === 'device' && parts.length >= 4 && parts[3] === 'events') {
    const topicId = parts[2]
    let body: Record<string, unknown>
    try { body = JSON.parse(payload.toString()) } catch { return }
    await handleDeviceEvent(topicId, body)
    return
  }

  if (parts.length < 4 || parts[0] !== 'users') return

  const pin = parts[1]
  const topicSource = parts[2]

  let body: Record<string, unknown>
  try { body = JSON.parse(payload.toString()) } catch { return }

  if (topicSource === 'admin' && client) {
    const action = parts[3] ?? ''
    await handleAdminMessage(client, pin, action, body)
    return
  }

  await handleHealthEvent(pin, body)
}
