import { db } from '../core/db'
import { usersPin } from '../core/db/schema/pin'
import { events } from '../core/db/schema'
import { eq } from 'drizzle-orm'

export async function routeMessage(topic: string, payload: Buffer): Promise<void> {
  const parts = topic.split('/')
  if (parts.length < 4 || parts[0] !== 'users') return

  const pin = parts[1]
  const topicSource = parts[2]

  let body: Record<string, unknown>
  try { body = JSON.parse(payload.toString()) } catch { return }
  if (!body.metric || body.value === undefined) return

  const [pinRecord] = await db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
  if (!pinRecord) return

  const numValue = Number(body.value)
  if (isNaN(numValue)) return

  const tags: Record<string, unknown> = { topicSource }
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
