import type { PatientProfile } from '../types'
import { elderlyCardiacProfile } from './elderly-cardiac'

export const profiles: Record<string, PatientProfile> = {
  'elderly-cardiac': elderlyCardiacProfile,
}

export function getProfile(id: string): PatientProfile {
  const p = profiles[id]
  if (!p) throw new Error(`Profile not found: ${id}`)
  return p
}
