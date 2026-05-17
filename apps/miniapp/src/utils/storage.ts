import Taro from '@tarojs/taro'

const STORAGE_KEY = 'health_records'

export interface HealthRecord {
  id: string
  type: 'blood_glucose' | 'blood_pressure' | 'weight' | 'heart_rate' | 'temperature' | 'spo2' | 'medication' | 'period'
  data: Record<string, unknown>
  recordedAt: string
  synced: boolean
}

export function getLocalRecords(type?: string): HealthRecord[] {
  const all: HealthRecord[] = Taro.getStorageSync(STORAGE_KEY) || []
  return type ? all.filter(r => r.type === type) : all
}

export function addLocalRecord(record: Omit<HealthRecord, 'id' | 'synced'>): HealthRecord {
  const all = getLocalRecords()
  const newRecord: HealthRecord = {
    ...record,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    synced: false,
  }
  all.push(newRecord)
  Taro.setStorageSync(STORAGE_KEY, all)
  return newRecord
}

export function markSynced(ids: string[]): void {
  const all = getLocalRecords()
  for (const record of all) {
    if (ids.includes(record.id)) record.synced = true
  }
  Taro.setStorageSync(STORAGE_KEY, all)
}

export function getUnsyncedRecords(): HealthRecord[] {
  return getLocalRecords().filter(r => !r.synced)
}

export function getTrendData(type: string, days: number = 7): { value: number; date: string }[] {
  const records = getLocalRecords(type)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const filtered = records
    .filter(r => new Date(r.recordedAt).getTime() > cutoff)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .slice(-days)

  return filtered.map(r => ({
    date: r.recordedAt.slice(0, 10),
    value: extractPrimaryValue(r),
  }))
}

function extractPrimaryValue(record: HealthRecord): number {
  switch (record.type) {
    case 'blood_glucose': return record.data.value_mgdl as number
    case 'blood_pressure': return record.data.systolic as number
    case 'weight': return record.data.weight_kg as number
    case 'heart_rate': return record.data.bpm as number
    case 'temperature': return record.data.celsius as number
    case 'spo2': return record.data.percentage as number
    default: return 0
  }
}
