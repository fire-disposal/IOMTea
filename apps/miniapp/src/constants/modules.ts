import { HEALTH_MODULE_META, HEALTH_MODULE_KEYS, type HealthModuleKey } from '@iomtea/shared-types'

export { HEALTH_MODULE_META, HEALTH_MODULE_KEYS }
export type { HealthModuleKey }

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
