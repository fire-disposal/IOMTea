import type { PatientProfile } from '../types'
import { copdRespiratoryProfile } from './copd-respiratory'
import { diabetesProfile } from './diabetes'
import { elderlyCardiacProfile } from './elderly-cardiac'
import { maternityProfile } from './maternity'
import { postSurgeryProfile } from './post-surgery'

export const profiles: Record<string, PatientProfile> = {
  'elderly-cardiac': elderlyCardiacProfile,
  'post-surgery': postSurgeryProfile,
  diabetes: diabetesProfile,
  'copd-respiratory': copdRespiratoryProfile,
  maternity: maternityProfile,
}

export function getProfile(id: string): PatientProfile {
  const p = profiles[id]
  if (!p) throw new Error(`Profile not found: ${id}`)
  return p
}

export function listProfiles() {
  return Object.entries(profiles).map(([id, p]) => ({
    id,
    name: p.name,
    conditions: p.conditions,
    demographics: p.demographics,
    deviceCount: p.devices.length,
    alertCount: p.alerts.length,
  }))
}
