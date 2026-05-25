export interface MetricConfig {
  metric: string
  unit: string
  interval: { min: number; max: number }
  jitter: number
  generator: string
}

export interface ProfileBaselines {
  heartRate: { mean: number; std: number }
  spo2: { mean: number; std: number }
  temperature: { mean: number; std: number }
  systolicBp: { mean: number; std: number }
  diastolicBp: { mean: number; std: number }
  glucose: { mean: number; std: number }
  respiratoryRate: { mean: number; std: number }
}

export interface UnifiedProfile {
  name: string
  displayName: string
  description: string
  baselines: ProfileBaselines
  metrics: MetricConfig[]
  conditions: string[]
}

const defaultMetrics: MetricConfig[] = [
  {
    metric: 'heart_rate',
    unit: 'bpm',
    interval: { min: 3000, max: 5000 },
    jitter: 0.2,
    generator: 'heartRate',
  },
  {
    metric: 'resp_rate',
    unit: 'rpm',
    interval: { min: 3000, max: 5000 },
    jitter: 0.2,
    generator: 'respiratoryRate',
  },
  {
    metric: 'spo2',
    unit: '%',
    interval: { min: 3000, max: 5000 },
    jitter: 0.15,
    generator: 'spo2',
  },
  {
    metric: 'temperature',
    unit: '°C',
    interval: { min: 60000, max: 120000 },
    jitter: 0.1,
    generator: 'temperature',
  },
  {
    metric: 'systolic_bp',
    unit: 'mmHg',
    interval: { min: 30000, max: 60000 },
    jitter: 0.15,
    generator: 'systolicBp',
  },
  {
    metric: 'diastolic_bp',
    unit: 'mmHg',
    interval: { min: 30000, max: 60000 },
    jitter: 0.15,
    generator: 'diastolicBp',
  },
  {
    metric: 'glucose',
    unit: 'mmol/L',
    interval: { min: 300000, max: 600000 },
    jitter: 0.2,
    generator: 'glucose',
  },
  {
    metric: 'posture',
    unit: '',
    interval: { min: 5000, max: 30000 },
    jitter: 0.5,
    generator: 'posture',
  },
  {
    metric: 'bed_status',
    unit: '',
    interval: { min: 5000, max: 30000 },
    jitter: 0.3,
    generator: 'bedStatus',
  },
  {
    metric: 'motion_index',
    unit: '',
    interval: { min: 10000, max: 30000 },
    jitter: 0.3,
    generator: 'motionIndex',
  },
]

const profiles: Record<string, UnifiedProfile> = {
  'elderly-cardiac': {
    name: 'elderly-cardiac',
    displayName: '老年心血管患者',
    description: '65-85岁，高血压+跌倒风险患者',
    baselines: {
      heartRate: { mean: 78, std: 8 },
      spo2: { mean: 96, std: 2 },
      temperature: { mean: 36.5, std: 0.3 },
      systolicBp: { mean: 135, std: 10 },
      diastolicBp: { mean: 85, std: 6 },
      glucose: { mean: 5.8, std: 1.2 },
      respiratoryRate: { mean: 16, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['hypertension', 'fall_risk'],
  },
  diabetes: {
    name: 'diabetes',
    displayName: '糖尿病患者',
    description: '40-75岁，2型糖尿病+神经病变风险',
    baselines: {
      heartRate: { mean: 72, std: 6 },
      spo2: { mean: 97, std: 1.5 },
      temperature: { mean: 36.6, std: 0.2 },
      systolicBp: { mean: 130, std: 8 },
      diastolicBp: { mean: 82, std: 5 },
      glucose: { mean: 7.5, std: 2.5 },
      respiratoryRate: { mean: 15, std: 2 },
    },
    metrics: defaultMetrics,
    conditions: ['diabetes_type2', 'neuropathy_risk'],
  },
  'post-surgery': {
    name: 'post-surgery',
    displayName: '术后恢复患者',
    description: '30-70岁，感染+出血风险',
    baselines: {
      heartRate: { mean: 85, std: 10 },
      spo2: { mean: 95, std: 2 },
      temperature: { mean: 37.2, std: 0.5 },
      systolicBp: { mean: 125, std: 10 },
      diastolicBp: { mean: 80, std: 7 },
      glucose: { mean: 6.0, std: 1.0 },
      respiratoryRate: { mean: 18, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['post_op', 'infection_risk'],
  },
  'copd-respiratory': {
    name: 'copd-respiratory',
    displayName: 'COPD呼吸疾病患者',
    description: '55-85岁，低血氧+呼吸窘迫风险',
    baselines: {
      heartRate: { mean: 95, std: 12 },
      spo2: { mean: 92, std: 3 },
      temperature: { mean: 36.8, std: 0.3 },
      systolicBp: { mean: 140, std: 12 },
      diastolicBp: { mean: 88, std: 8 },
      glucose: { mean: 5.5, std: 1.0 },
      respiratoryRate: { mean: 25, std: 5 },
    },
    metrics: defaultMetrics,
    conditions: ['copd', 'hypoxemia_risk'],
  },
  maternity: {
    name: 'maternity',
    displayName: '孕产监护',
    description: '22-42岁，妊娠高血压风险',
    baselines: {
      heartRate: { mean: 90, std: 10 },
      spo2: { mean: 97, std: 1.5 },
      temperature: { mean: 36.8, std: 0.3 },
      systolicBp: { mean: 120, std: 8 },
      diastolicBp: { mean: 70, std: 6 },
      glucose: { mean: 5.2, std: 1.5 },
      respiratoryRate: { mean: 18, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['gestational_hypertension_risk'],
  },
}

export function getProfile(name: string): UnifiedProfile {
  const p = profiles[name]
  if (!p) throw new Error(`Profile not found: ${name}`)
  return p
}

export function listProfiles() {
  return Object.entries(profiles).map(([id, p]) => ({
    id,
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    conditions: p.conditions,
    metrics: p.metrics.map((m) => ({ metric: m.metric, unit: m.unit })),
  }))
}

export { profiles }
