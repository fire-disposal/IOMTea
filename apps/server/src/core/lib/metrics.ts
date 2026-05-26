const METRIC_ALIASES: Record<string, string> = {
  hr: 'heart_rate',
  pulse: 'heart_rate',
  heartrate: 'heart_rate',
  heartbeat: 'heart_rate',
  heart: 'heart_rate',
  spo2: 'spo2',
  spO2: 'spo2',
  oxygen: 'spo2',
  blood_oxygen: 'spo2',
  o2: 'spo2',
  temp: 'temperature',
  body_temperature: 'temperature',
  body_temp: 'temperature',
  bodytemp: 'temperature',
  systolic: 'systolic_bp',
  sbp: 'systolic_bp',
  bp_sys: 'systolic_bp',
  diastolic: 'diastolic_bp',
  dbp: 'diastolic_bp',
  bp_dia: 'diastolic_bp',
  bloodpressure: 'systolic_bp',
  glucose: 'glucose',
  blood_glucose: 'glucose',
  blood_sugar: 'glucose',
  bg: 'glucose',
  resp: 'resp_rate',
  respiration: 'resp_rate',
  rr: 'resp_rate',
  posture: 'posture',
  position: 'posture',
  bed: 'bed_status',
  bed_status: 'bed_status',
  bedstatus: 'bed_status',
  motion: 'motion_index',
  activity: 'motion_index',
  movement: 'motion_index',
  medication: 'medication',
  med: 'medication',
  period: 'period',
  menstrual: 'period',
  weight: 'weight',
  body_weight: 'weight',
}

const METRIC_UNITS: Record<string, string> = {
  heart_rate: 'bpm',
  spo2: '%',
  temperature: '°C',
  systolic_bp: 'mmHg',
  diastolic_bp: 'mmHg',
  glucose: 'mmol/L',
  resp_rate: 'rpm',
  weight: 'kg',
}

const METRIC_RANGES: Record<string, { min: number; max: number }> = {
  heart_rate: { min: 20, max: 260 },
  spo2: { min: 40, max: 100 },
  temperature: { min: 30, max: 45 },
  systolic_bp: { min: 40, max: 280 },
  diastolic_bp: { min: 20, max: 180 },
  glucose: { min: 0.5, max: 35 },
  resp_rate: { min: 4, max: 60 },
  weight: { min: 1, max: 500 },
  motion_index: { min: 0, max: 10 },
}

export function normalizeMetric(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return METRIC_ALIASES[normalized] || normalized
}

export function getMetricUnit(metric: string): string | undefined {
  return METRIC_UNITS[metric]
}

export function isValueInRange(metric: string, value: number): boolean {
  const range = METRIC_RANGES[metric]
  if (!range) return true
  return value >= range.min && value <= range.max
}

