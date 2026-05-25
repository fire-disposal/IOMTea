// apps/server/src/core/pipeline/registry.ts

import { z } from 'zod'

export interface MetricField {
  path: string
  label: string
  type: 'number' | 'text' | 'choice' | 'boolean'
  choices?: string[]
}

export interface MetricDefinition {
  metric: string
  displayName: string
  unit: string
  valueSchema: z.ZodSchema
  valueType: 'scalar' | 'object'
  fields?: MetricField[]
  normalRange?: { min: number; max: number }
  alertThresholds?: { low?: number; high?: number }
  defaultChart: 'line' | 'bar' | 'gauge' | 'scatter'
  category: 'vital' | 'ema' | 'behavior' | 'lab' | 'custom'
}

const metricRegistry = new Map<string, MetricDefinition>()

export function registerMetric(def: MetricDefinition): void {
  if (metricRegistry.has(def.metric)) {
    console.warn(`[registry] metric "${def.metric}" already registered, overwriting`)
  }
  metricRegistry.set(def.metric, def)
}

export function getMetric(metric: string): MetricDefinition | undefined {
  return metricRegistry.get(metric)
}

export function listMetrics(category?: string): MetricDefinition[] {
  const all = Array.from(metricRegistry.values())
  if (category) return all.filter((m) => m.category === category)
  return all
}

export function getMetricOrDefault(metric: string): MetricDefinition {
  const def = metricRegistry.get(metric)
  if (def) return def
  return {
    metric,
    displayName: metric,
    unit: '',
    valueSchema: z.unknown(),
    valueType: 'scalar',
    defaultChart: 'line',
    category: 'custom',
  }
}

export function resolveField(
  metric: string,
  fieldPath?: string,
): { definition: MetricDefinition; field?: MetricField } | null {
  const def = getMetric(metric)
  if (!def) return null
  if (def.valueType === 'scalar') return { definition: def }
  if (!fieldPath) return { definition: def }
  const field = def.fields?.find((f) => f.path === fieldPath)
  return { definition: def, field }
}

// ── Default vital sign registrations ──

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
  metric: 'respiratory_rate',
  displayName: '呼吸率',
  unit: '次/分',
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
