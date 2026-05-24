import type { Profile, MetricConfig } from './types'

const defaultMetrics: MetricConfig[] = [
  { metric: 'heart_rate',     unit: 'bpm',    interval: { min: 3000, max: 5000 },    jitter: 0.2,  generator: 'heartRate' },
  { metric: 'resp_rate',       unit: 'rpm',    interval: { min: 3000, max: 5000 },    jitter: 0.2,  generator: 'respiratoryRate' },
  { metric: 'spo2',            unit: '%',      interval: { min: 3000, max: 5000 },    jitter: 0.15, generator: 'spo2' },
  { metric: 'temperature',     unit: '°C',     interval: { min: 60000, max: 120000 }, jitter: 0.1,  generator: 'temperature' },
  { metric: 'systolic_bp',     unit: 'mmHg',   interval: { min: 30000, max: 60000 },  jitter: 0.15, generator: 'systolicBp' },
  { metric: 'diastolic_bp',    unit: 'mmHg',   interval: { min: 30000, max: 60000 },  jitter: 0.15, generator: 'diastolicBp' },
  { metric: 'glucose',         unit: 'mmol/L', interval: { min: 300000, max: 600000 },jitter: 0.2,  generator: 'glucose' },
  { metric: 'posture',         unit: '',        interval: { min: 5000, max: 30000 },   jitter: 0.5,  generator: 'posture' },
  { metric: 'bed_status',      unit: '',        interval: { min: 5000, max: 30000 },   jitter: 0.3,  generator: 'bedStatus' },
  { metric: 'motion_index',    unit: '',        interval: { min: 10000, max: 30000 },  jitter: 0.3,  generator: 'motionIndex' },
]

export const profiles: Record<string, Profile> = {
  'elderly-cardiac': {
    name: 'elderly-cardiac', label: '老年心脏',
    baselines: {
      heart_rate: { mean: 78, std: 8 }, spo2: { mean: 96, std: 2 },
      temperature: { mean: 36.5, std: 0.3 }, systolic_bp: { mean: 135, std: 10 },
      diastolic_bp: { mean: 85, std: 6 }, glucose: { mean: 5.8, std: 1.2 },
      resp_rate: { mean: 16, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['hypertension', 'fall_risk'],
  },
  'diabetes': {
    name: 'diabetes', label: '糖尿病',
    baselines: {
      heart_rate: { mean: 72, std: 6 }, spo2: { mean: 97, std: 1.5 },
      temperature: { mean: 36.6, std: 0.2 }, systolic_bp: { mean: 130, std: 8 },
      diastolic_bp: { mean: 82, std: 5 }, glucose: { mean: 7.5, std: 2.5 },
      resp_rate: { mean: 15, std: 2 },
    },
    metrics: defaultMetrics,
    conditions: ['diabetes_type2', 'neuropathy_risk'],
  },
  'post-surgery': {
    name: 'post-surgery', label: '术后恢复',
    baselines: {
      heart_rate: { mean: 85, std: 10 }, spo2: { mean: 95, std: 2 },
      temperature: { mean: 37.2, std: 0.5 }, systolic_bp: { mean: 125, std: 10 },
      diastolic_bp: { mean: 80, std: 7 }, glucose: { mean: 6.0, std: 1.0 },
      resp_rate: { mean: 18, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['post_op', 'infection_risk'],
  },
  'copd-respiratory': {
    name: 'copd-respiratory', label: 'COPD呼吸',
    baselines: {
      heart_rate: { mean: 95, std: 12 }, spo2: { mean: 92, std: 3 },
      temperature: { mean: 36.8, std: 0.3 }, systolic_bp: { mean: 140, std: 12 },
      diastolic_bp: { mean: 88, std: 8 }, glucose: { mean: 5.5, std: 1.0 },
      resp_rate: { mean: 25, std: 5 },
    },
    metrics: defaultMetrics,
    conditions: ['copd', 'hypoxemia_risk'],
  },
  'maternity': {
    name: 'maternity', label: '产科',
    baselines: {
      heart_rate: { mean: 90, std: 10 }, spo2: { mean: 97, std: 1.5 },
      temperature: { mean: 36.8, std: 0.3 }, systolic_bp: { mean: 120, std: 8 },
      diastolic_bp: { mean: 70, std: 6 }, glucose: { mean: 5.2, std: 1.5 },
      resp_rate: { mean: 18, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['gestational_hypertension_risk'],
  },
}
