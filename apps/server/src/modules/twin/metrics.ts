import { registerMetric } from '../../core/pipeline/registry'
import { z } from 'zod'

registerMetric({
  metric: 'heart_rate',
  displayName: '心率',
  unit: 'bpm',
  valueSchema: z.number().min(20).max(250),
  valueType: 'scalar',
  normalRange: { min: 60, max: 100 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'resp_rate',
  displayName: '呼吸率',
  unit: 'rpm',
  valueSchema: z.number().min(5).max(60),
  valueType: 'scalar',
  normalRange: { min: 12, max: 20 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'spo2',
  displayName: '血氧饱和度',
  unit: '%',
  valueSchema: z.number().min(50).max(100),
  valueType: 'scalar',
  normalRange: { min: 95, max: 100 },
  alertThresholds: { low: 92 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'temperature',
  displayName: '体温',
  unit: '°C',
  valueSchema: z.number().min(30).max(45),
  valueType: 'scalar',
  normalRange: { min: 36.0, max: 37.3 },
  alertThresholds: { high: 38.0 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'systolic_bp',
  displayName: '收缩压',
  unit: 'mmHg',
  valueSchema: z.number().min(60).max(250),
  valueType: 'scalar',
  normalRange: { min: 90, max: 140 },
  alertThresholds: { high: 160 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'diastolic_bp',
  displayName: '舒张压',
  unit: 'mmHg',
  valueSchema: z.number().min(30).max(150),
  valueType: 'scalar',
  normalRange: { min: 60, max: 90 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'glucose',
  displayName: '血糖',
  unit: 'mmol/L',
  valueSchema: z.number().min(1).max(35),
  valueType: 'scalar',
  normalRange: { min: 3.9, max: 6.1 },
  defaultChart: 'line',
  category: 'vital',
})

registerMetric({
  metric: 'motion_index',
  displayName: '活动指数',
  unit: '',
  valueSchema: z.number().min(0).max(1),
  valueType: 'scalar',
  normalRange: { min: 0.1, max: 0.6 },
  defaultChart: 'bar',
  category: 'behavior',
})

registerMetric({
  metric: 'posture',
  displayName: '姿态',
  unit: '',
  valueSchema: z.string(),
  valueType: 'scalar',
  defaultChart: 'bar',
  category: 'behavior',
})

registerMetric({
  metric: 'bed_status',
  displayName: '卧床状态',
  unit: '',
  valueSchema: z.string(),
  valueType: 'scalar',
  defaultChart: 'bar',
  category: 'behavior',
})
