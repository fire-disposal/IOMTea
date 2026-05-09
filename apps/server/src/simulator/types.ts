export interface PatientProfile {
  id: string
  name: string
  demographics: {
    ageRange: [number, number]
    gender: 'male' | 'female' | 'other' | 'any'
    weightRange: [number, number]
  }
  baseline: {
    heartRate: { resting: number; variability: number; circadianFactor: number }
    respiratoryRate: { resting: number; variability: number }
    temperature: { resting: number; variability: number }
    spO2: { resting: number; variability: number }
  }
  conditions: string[]
  schedule: {
    sleep: { start: string; end: string }
    meals: { time: string }[]
    events: { type: string; window: [string, string]; probability: number }[]
  }
  devices: string[]
  alerts: {
    metric: string
    condition: 'gt' | 'lt' | 'eq'
    threshold: number
    severity: 'critical' | 'warning' | 'info'
    message: string
  }[]
}

export type ActivityLevel = 'resting' | 'light' | 'moderate' | 'heavy'

export interface PatientInstance {
  id: string
  name: string
  profileId: string
  patientDbId: string
  deviceDbId: string
  activity: ActivityLevel
  baselines: PatientProfile['baseline']
  conditions: string[]
  alerts: PatientProfile['alerts']
}

export interface SimulatedEvent {
  patientId: string
  deviceId: string
  kind: 'observation' | 'alert'
  metric: string
  value: number | null
  unit: string | null
  severity?: 'critical' | 'warning' | 'info'
  status?: 'active' | 'acknowledged' | 'resolved'
  tags: Record<string, unknown>
  recordedAt: Date
}

export interface WardState {
  id: string
  name: string
  speed: number
  running: boolean
  patientCount: number
  startedAt: Date | null
  tick: number
}
