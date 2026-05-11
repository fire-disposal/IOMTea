export interface ThresholdRule {
  metric: string
  label: string
  min?: number
  max?: number
  unit: string
  enabled: boolean
}

export const DEFAULT_THRESHOLDS: Record<string, ThresholdRule[]> = {
  'elderly-cardiac': [
    { metric: 'heart_rate', label: '心率', min: 50, max: 120, unit: 'bpm', enabled: true },
    { metric: 'spo2', label: '血氧', min: 92, unit: '%', enabled: true },
    { metric: 'systolic_bp', label: '收缩压', min: 90, max: 160, unit: 'mmHg', enabled: true },
    { metric: 'diastolic_bp', label: '舒张压', min: 60, max: 100, unit: 'mmHg', enabled: true },
    { metric: 'temperature', label: '体温', min: 36, max: 38, unit: '°C', enabled: true },
    { metric: 'resp_rate', label: '呼吸率', min: 8, max: 30, unit: 'rpm', enabled: true },
  ],
  'post-surgery': [
    { metric: 'heart_rate', label: '心率', min: 50, max: 130, unit: 'bpm', enabled: true },
    { metric: 'spo2', label: '血氧', min: 94, unit: '%', enabled: true },
    { metric: 'temperature', label: '体温', min: 36, max: 38.5, unit: '°C', enabled: true },
    { metric: 'systolic_bp', label: '收缩压', min: 90, max: 140, unit: 'mmHg', enabled: true },
    { metric: 'diastolic_bp', label: '舒张压', min: 60, max: 90, unit: 'mmHg', enabled: true },
    { metric: 'resp_rate', label: '呼吸率', min: 8, max: 25, unit: 'rpm', enabled: true },
  ],
  diabetes: [
    { metric: 'heart_rate', label: '心率', min: 50, max: 110, unit: 'bpm', enabled: true },
    { metric: 'spo2', label: '血氧', min: 92, unit: '%', enabled: true },
    { metric: 'glucose', label: '血糖', min: 3.5, max: 11, unit: 'mmol/L', enabled: true },
    { metric: 'systolic_bp', label: '收缩压', min: 90, max: 150, unit: 'mmHg', enabled: true },
    { metric: 'diastolic_bp', label: '舒张压', min: 60, max: 95, unit: 'mmHg', enabled: true },
    { metric: 'resp_rate', label: '呼吸率', min: 8, max: 25, unit: 'rpm', enabled: true },
  ],
  'copd-respiratory': [
    { metric: 'heart_rate', label: '心率', min: 60, max: 130, unit: 'bpm', enabled: true },
    { metric: 'spo2', label: '血氧', min: 90, unit: '%', enabled: true },
    { metric: 'resp_rate', label: '呼吸率', min: 12, max: 35, unit: 'rpm', enabled: true },
    { metric: 'systolic_bp', label: '收缩压', min: 90, max: 150, unit: 'mmHg', enabled: true },
    { metric: 'diastolic_bp', label: '舒张压', min: 60, max: 95, unit: 'mmHg', enabled: true },
    { metric: 'temperature', label: '体温', min: 36, max: 38, unit: '°C', enabled: true },
  ],
  maternity: [
    { metric: 'heart_rate', label: '心率', min: 60, max: 110, unit: 'bpm', enabled: true },
    { metric: 'spo2', label: '血氧', min: 95, unit: '%', enabled: true },
    { metric: 'systolic_bp', label: '收缩压', min: 90, max: 140, unit: 'mmHg', enabled: true },
    { metric: 'diastolic_bp', label: '舒张压', min: 60, max: 90, unit: 'mmHg', enabled: true },
    { metric: 'temperature', label: '体温', min: 36, max: 37.5, unit: '°C', enabled: true },
    { metric: 'resp_rate', label: '呼吸率', min: 8, max: 25, unit: 'rpm', enabled: true },
  ],
}
