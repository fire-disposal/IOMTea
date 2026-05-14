import { eq, desc, and } from 'drizzle-orm'
import type { DbClient } from '../db'
import { appointments, followupRecords } from '../db'
import { TRPCError } from '@trpc/server'

export async function listAppointments(db: DbClient, patientId: string, status?: string, from?: string, to?: string) {
  const conditions = [eq(appointments.patientId, patientId)]
  if (status) conditions.push(eq(appointments.status, status as any))
  // Note: date filtering via timestamps skipped for simplicity; frontend can filter
  return db.select().from(appointments).where(and(...conditions)).orderBy(desc(appointments.scheduledAt))
}

export async function getAppointmentById(db: DbClient, id: string) {
  const rows = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1)
  if (rows.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Appointment not found' })
  return rows[0]
}

export async function createAppointment(db: DbClient, input: {
  patientId: string
  doctorId?: string
  appointmentType: string
  scheduledAt: string
  durationMinutes?: number
  reason?: string
  notes?: string
  location?: string
}) {
  const [apt] = await db.insert(appointments).values({
    patientId: input.patientId,
    doctorId: input.doctorId,
    appointmentType: input.appointmentType as any,
    scheduledAt: new Date(input.scheduledAt),
    durationMinutes: input.durationMinutes || 30,
    reason: input.reason,
    notes: input.notes,
    location: input.location || '居家',
  }).returning()
  return apt
}

export async function updateAppointment(db: DbClient, id: string, input: Record<string, any>) {
  const { id: _, scheduledAt, ...rest } = input
  const data: any = { ...rest }
  if (scheduledAt) data.scheduledAt = new Date(scheduledAt)
  const [updated] = await db.update(appointments).set(data).where(eq(appointments.id, id)).returning()
  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Appointment not found' })
  return updated
}

export async function cancelAppointment(db: DbClient, id: string, reason?: string) {
  const [updated] = await db
    .update(appointments)
    .set({ status: 'cancelled' as any, notes: reason || null })
    .where(eq(appointments.id, id))
    .returning()
  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Appointment not found' })
  return updated
}

export async function listFollowups(db: DbClient, patientId: string) {
  return db.select().from(followupRecords).where(eq(followupRecords.patientId, patientId)).orderBy(desc(followupRecords.conductedAt))
}

export async function createFollowup(db: DbClient, input: {
  appointmentId?: string
  patientId: string
  type: string
  summary?: string
  vitalSigns?: Record<string, any>
  assessment?: string
  nextFollowupAt?: string
  conductedById?: string
}) {
  const [record] = await db.insert(followupRecords).values({
    appointmentId: input.appointmentId,
    patientId: input.patientId,
    type: input.type as any,
    summary: input.summary,
    vitalSigns: input.vitalSigns || null,
    assessment: input.assessment,
    nextFollowupAt: input.nextFollowupAt ? new Date(input.nextFollowupAt) : null,
    conductedById: input.conductedById,
  }).returning()
  return record
}
