import { TRPCError } from '@trpc/server'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { DbClient } from '../db'
import { events, medicationAdherence, medicationSchedules, medications } from '../db'
import type {
  AdherenceStatus,
  ConfirmationMethod,
  EventKind,
  EventSource,
  MedicationRoute,
  MedicationStatus,
} from '../db/schema/enums'
import { createChildLogger } from '../lib/logger'

const logger = createChildLogger('medication')

export async function listMedications(db: DbClient, patientId: string, status?: MedicationStatus) {
  const conditions = [eq(medications.patientId, patientId)]
  if (status) conditions.push(eq(medications.status, status))
  return db
    .select()
    .from(medications)
    .where(and(...conditions))
    .orderBy(desc(medications.createdAt))
}

export async function listAllMedications(
  db: DbClient,
  opts?: { status?: MedicationStatus; patientIds?: string[] },
) {
  const conditions = []
  if (opts?.status) conditions.push(eq(medications.status, opts.status))
  if (opts?.patientIds?.length) conditions.push(inArray(medications.patientId, opts.patientIds))
  return db
    .select()
    .from(medications)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(medications.createdAt))
}

export async function getMedicationById(db: DbClient, id: string) {
  const rows = await db.select().from(medications).where(eq(medications.id, id)).limit(1)
  if (rows.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Medication not found' })
  return rows[0]
}

export async function createMedication(
  db: DbClient,
  input: {
    patientId: string
    drugName: string
    genericName?: string
    dosage: string
    dosageUnit: string
    frequency: string
    route?: MedicationRoute
    startDate: string
    endDate?: string
    instructions?: string
    status?: MedicationStatus
    prescribedById?: string
  },
) {
  const route: MedicationRoute = input.route || 'oral'
  const status: MedicationStatus = input.status || 'active'
  const [med] = await db
    .insert(medications)
    .values({
      patientId: input.patientId,
      drugName: input.drugName,
      genericName: input.genericName,
      dosage: input.dosage,
      dosageUnit: input.dosageUnit,
      frequency: input.frequency,
      route,
      startDate: input.startDate,
      endDate: input.endDate,
      instructions: input.instructions,
      status,
      prescribedById: input.prescribedById,
    })
    .returning()
  return med
}

export async function updateMedication(
  db: DbClient,
  id: string,
  input: {
    drugName?: string
    genericName?: string | null
    dosage?: string
    dosageUnit?: string
    frequency?: string
    route?: MedicationRoute
    startDate?: string
    endDate?: string | null
    instructions?: string | null
    status?: MedicationStatus
    prescribedById?: string | null
  },
) {
  const { id: _id, ...data } = input as { id?: string } & typeof input
  const [updated] = await db.update(medications).set(data).where(eq(medications.id, id)).returning()
  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Medication not found' })
  return updated
}

export async function deleteMedication(db: DbClient, id: string) {
  await db.delete(medications).where(eq(medications.id, id))
}

export async function listSchedules(db: DbClient, medicationId: string) {
  return db
    .select()
    .from(medicationSchedules)
    .where(eq(medicationSchedules.medicationId, medicationId))
}

export async function createSchedule(
  db: DbClient,
  medicationId: string,
  scheduledTime: string,
  dayOfWeek?: number[],
) {
  const [sched] = await db
    .insert(medicationSchedules)
    .values({
      medicationId,
      scheduledTime,
      dayOfWeek: dayOfWeek || null,
    })
    .returning()
  return sched
}

export async function getAdherence(db: DbClient, scheduleId: string, from?: string, to?: string) {
  const conditions = [eq(medicationAdherence.scheduleId, scheduleId)]
  if (from) conditions.push(sql`${medicationAdherence.dueDate} >= ${from}`)
  if (to) conditions.push(sql`${medicationAdherence.dueDate} <= ${to}`)
  return db
    .select()
    .from(medicationAdherence)
    .where(and(...conditions))
    .orderBy(desc(medicationAdherence.dueDate), desc(medicationAdherence.dueTime))
}

async function getMedicationForSchedule(db: DbClient, scheduleId: string) {
  const schedules = await db
    .select()
    .from(medicationSchedules)
    .where(eq(medicationSchedules.id, scheduleId))
    .limit(1)
  if (schedules.length === 0) return null
  const meds = await db
    .select()
    .from(medications)
    .where(eq(medications.id, schedules[0].medicationId))
    .limit(1)
  return meds.length > 0 ? meds[0] : null
}

export async function markTaken(
  db: DbClient,
  input: {
    scheduleId: string
    dueDate: string
    dueTime: string
    confirmedBy?: ConfirmationMethod
    notes?: string
  },
) {
  const existing = await db
    .select()
    .from(medicationAdherence)
    .where(
      and(
        eq(medicationAdherence.scheduleId, input.scheduleId),
        eq(medicationAdherence.dueDate, input.dueDate),
        eq(medicationAdherence.dueTime, input.dueTime),
      ),
    )
    .limit(1)

  let result: typeof medicationAdherence.$inferSelect | undefined

  if (existing.length > 0) {
    const [updated] = await db
      .update(medicationAdherence)
      .set({
        status: 'taken',
        takenAt: new Date(),
        confirmedBy: input.confirmedBy || 'self',
        notes: input.notes,
      })
      .where(eq(medicationAdherence.id, existing[0].id))
      .returning()
    result = updated
  } else {
    const [created] = await db
      .insert(medicationAdherence)
      .values({
        scheduleId: input.scheduleId,
        dueDate: input.dueDate,
        dueTime: input.dueTime,
        status: 'taken',
        takenAt: new Date(),
        confirmedBy: input.confirmedBy || 'self',
        notes: input.notes,
      })
      .returning()
    result = created
  }

  const med = await getMedicationForSchedule(db, input.scheduleId)
  if (med) {
    await db
      .insert(events)
      .values({
        patientId: med.patientId,
        kind: 'behavior',
        metric: 'medication_taken',
        value: null,
        unit: null,
        source: 'manual',
        tags: {
          scheduleId: input.scheduleId,
          dueDate: input.dueDate,
          dueTime: input.dueTime,
          drugName: med.drugName,
        },
        recordedAt: new Date(),
      })
      .catch((err) => {
        logger.warn({ err }, 'failed to insert medication_taken event')
      })
  }

  return result
}

export async function markMissed(
  db: DbClient,
  input: {
    scheduleId: string
    dueDate: string
    dueTime: string
    notes?: string
  },
) {
  const [created] = await db
    .insert(medicationAdherence)
    .values({
      scheduleId: input.scheduleId,
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      status: 'missed',
      notes: input.notes,
    })
    .returning()

  const med = await getMedicationForSchedule(db, input.scheduleId)
  if (med) {
    await db
      .insert(events)
      .values({
        patientId: med.patientId,
        kind: 'behavior',
        metric: 'medication_missed',
        value: null,
        unit: null,
        source: 'manual',
        tags: {
          scheduleId: input.scheduleId,
          dueDate: input.dueDate,
          dueTime: input.dueTime,
          drugName: med.drugName,
        },
        recordedAt: new Date(),
      })
      .catch((err) => {
        logger.warn({ err }, 'failed to insert medication_missed event')
      })
  }

  return created
}
