import type { DbClient } from '../../db'
import { events, medications, patients, users } from '../../db'
import { usersPin } from '../../db/schema/pin'
import { userPatientLinks } from '../../db/schema/user-patient'
import { hashPassword } from '../../lib/password'
import {
  PATIENTS,
  generatePin,
  generateVitals,
  recentAlertTime,
  buildHomeGraph,
  HOUR_MS,
} from './data'

export async function seedDemoData(db: DbClient): Promise<void> {
  const createdUsers: Map<string, string> = new Map()
  const createdPatients: Map<string, string> = new Map()
  const createdPins: Map<string, string[]> = new Map()

  for (const p of PATIENTS) {
    const [user] = await db
      .insert(users)
      .values({
        username: p.username,
        passwordHash: await hashPassword(p.password),
        displayName: p.name,
        role: 'user',
      })
      .returning({ id: users.id })
    createdUsers.set(p.username, user.id)

    const tags: Record<string, unknown> = {
      profileId: p.profileId,
      conditions: p.conditions,
    }
    if (p.hasHomeGraph) {
      tags.homeGraph = buildHomeGraph(p.graphPrefix)
    }

    const [patient] = await db
      .insert(patients)
      .values({
        name: p.name,
        birthDate: p.birthDate,
        gender: p.gender,
        heightCm: p.heightCm,
        weightKg: p.weightKg,
        status: 'active',
        tags,
      })
      .returning({ id: patients.id })
    createdPatients.set(p.username, patient.id)

    await db
      .insert(userPatientLinks)
      .values({ userId: user.id, patientId: patient.id, relation: 'primary' })
      .onConflictDoNothing()

    const pins: string[] = []
    for (const label of p.pinLabels) {
      const pin = generatePin()
      await db.insert(usersPin).values({
        pin,
        userId: user.id,
        label,
        nickname: p.name,
      })
      pins.push(pin)
    }
    createdPins.set(p.username, pins)
  }

  const observationRows: (typeof events.$inferInsert)[] = []

  for (const p of PATIENTS) {
    const patientId = createdPatients.get(p.username)!
    for (let hourOffset = 48; hourOffset >= 0; hourOffset--) {
      const ts = new Date(Date.now() - hourOffset * HOUR_MS)
      const hour = ts.getHours()
      const vitals = generateVitals(p.baselines, hour)

      const metrics = [
        { metric: 'heart_rate', value: vitals.hr, unit: 'bpm' },
        { metric: 'spo2', value: vitals.spo2, unit: '%' },
        { metric: 'systolic_bp', value: vitals.bpSys, unit: 'mmHg' },
        { metric: 'diastolic_bp', value: vitals.bpDia, unit: 'mmHg' },
        { metric: 'temperature', value: vitals.temp, unit: '°C' },
        { metric: 'glucose', value: vitals.glucose, unit: 'mmol/L' },
        { metric: 'resp_rate', value: vitals.respRate, unit: 'rpm' },
      ]

      for (const m of metrics) {
        observationRows.push({
          patientId,
          kind: 'observation',
          metric: m.metric,
          value: m.value,
          unit: m.unit,
          source: 'simulator',
          recordedAt: ts,
          tags: { simulated: true },
        })
      }
    }
  }

  const CHUNK = 200
  for (let i = 0; i < observationRows.length; i += CHUNK) {
    await db.insert(events).values(observationRows.slice(i, i + CHUNK))
  }

  const alertRows: (typeof events.$inferInsert)[] = []
  for (const p of PATIENTS) {
    const patientId = createdPatients.get(p.username)!
    for (let i = 0; i < p.alertScenarios.length; i++) {
      const s = p.alertScenarios[i]
      const ts = recentAlertTime(2 + i * 4)
      alertRows.push({
        patientId,
        kind: 'alert',
        metric: s.metric,
        value: s.value,
        unit: s.unit,
        severity: s.severity,
        status: 'active',
        source: 'simulator',
        recordedAt: ts,
        tags: { simulated: true, ...(s.tags || {}) },
      })
    }
  }
  if (alertRows.length > 0) {
    await db.insert(events).values(alertRows)
  }

  for (const p of PATIENTS) {
    const patientId = createdPatients.get(p.username)!
    const user = createdUsers.get(p.username)!

    for (const med of p.meds) {
      await db
        .insert(medications)
        .values({
          patientId,
          drugName: med.drugName,
          genericName: med.genericName,
          dosage: med.dosage,
          dosageUnit: med.dosageUnit,
          frequency: med.frequency,
          route: med.route,
          startDate: new Date(Date.now() - 14 * 24 * HOUR_MS).toISOString().slice(0, 10),
          status: 'active',
          instructions: med.instructions,
          prescribedById: user,
        })
        .returning({ id: medications.id })
    }
  }
}
