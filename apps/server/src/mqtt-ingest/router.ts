import { db } from '../core/db'
import { usersPin } from '../core/db/schema/pin'
import { events } from '../core/db/schema'
import { eq } from 'drizzle-orm'
import mqtt from 'mqtt'

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
