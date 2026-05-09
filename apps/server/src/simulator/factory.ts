import { v4 as uuid } from 'uuid'
import type { PatientProfile, PatientInstance } from './types'

export interface FactoryDeps {
  db: any
}

export async function createPatientInstance(
  deps: FactoryDeps,
  profile: PatientProfile,
  name: string,
): Promise<PatientInstance> {
  const db = deps.db
  const { patients, devices } = await import('../core/db/schema')

  const [patient] = await db
    .insert(patients)
    .values({
      name,
      status: 'active',
      tags: { profileId: profile.id, conditions: profile.conditions, simulated: true },
    })
    .returning()

  const deviceType = profile.devices[0] || 'simulator'
  const serial = `sim-${name.replace(/\s/g, '-').toLowerCase()}-${Date.now()}`
  const [device] = await db
    .insert(devices)
    .values({
      serialNumber: serial,
      deviceType,
      patientId: patient.id,
      tags: { simulated: true, profileId: profile.id },
    })
    .returning()

  return {
    id: uuid(),
    name,
    profileId: profile.id,
    patientDbId: patient.id,
    deviceDbId: device.id,
    activity: 'resting',
    baselines: profile.baseline,
    conditions: profile.conditions,
    alerts: profile.alerts,
  }
}
