import { HEALTH_MODULE_KEYS, HEALTH_MODULE_META, type HealthModuleKey } from '@iomtea/shared-types'

export { HEALTH_MODULE_META, HEALTH_MODULE_KEYS }
export type { HealthModuleKey }

export const HEALTH_MODULE_LABELS: Record<string, string> = {
  blood_glucose: HEALTH_MODULE_META.blood_glucose.label,
  blood_pressure: HEALTH_MODULE_META.blood_pressure.label,
  weight: HEALTH_MODULE_META.weight.label,
  heart_rate: HEALTH_MODULE_META.heart_rate.label,
  temperature: HEALTH_MODULE_META.temperature.label,
  spo2: HEALTH_MODULE_META.spo2.label,
  medication: HEALTH_MODULE_META.medication.label,
  period: HEALTH_MODULE_META.period.label,
}

export const PIN_TYPE_LABELS: Record<string, string> = {
  device: '设备',
  virtual: '虚拟',
  user: '用户',
  simulator: '仿真',
}

export function getRecordPage(key: string): string {
  const pages: Record<string, string> = {
    blood_glucose: '/pages/record/glucose/index',
    blood_pressure: '/pages/record/pressure/index',
    weight: '/pages/record/weight/index',
    heart_rate: '/pages/record/heart-rate/index',
    temperature: '/pages/record/temperature/index',
    spo2: '/pages/record/spo2/index',
    medication: '/pages/record/medication/index',
    period: '/pages/record/period/index',
  }
  return pages[key] || ''
}
