export interface MetricConfig {
  metric: string
  unit: string
  interval: { min: number; max: number }
  jitter: number
  generator: string
}

export interface Profile {
  name: string
  label: string
  baselines: Record<string, { mean: number; std: number }>
  metrics: MetricConfig[]
  conditions: string[]
}

export interface SimStatus {
  patientId: string
  patientName: string
  profile: string
  running: boolean
  lastValues: Record<string, number>
  tickCount: number
}
