import Taro from '@tarojs/taro'
import { api } from './api'
import { STORAGE_KEYS } from '../constants/storage-keys'

export async function syncUnsyncedRecords(): Promise<void> {
  const records = (Taro.getStorageSync(STORAGE_KEYS.RECORDS) || []) as any[]
  const unsynced = records.filter((r: any) => !r.synced)

  if (unsynced.length === 0) return

  const events = unsynced.map((r: any) => {
    let metric = r.type
    let value = r.data

    if (r.type === 'blood_glucose') { metric = 'glucose'; value = r.data.value_mgdl ?? Number(r.data.value) }
    else if (r.type === 'blood_pressure') { metric = 'systolic_bp'; value = Number(r.data.systolic) }
    else if (r.type === 'weight') metric = 'weight'
    else if (r.type === 'medication') { metric = 'medication'; value = r.data }
    else if (r.type === 'period') { metric = 'period'; value = r.data }

    return {
      patientId: Taro.getStorageSync(STORAGE_KEYS.PATIENT_ID) || '',
      kind: 'observation',
      metric,
      value: typeof value === 'number' ? value : value ?? 0,
      source: 'manual',
      recordedAt: r.recordedAt || new Date().toISOString(),
    }
  })

  await api.post('/ingest/batch', { events })

  for (const r of unsynced) r.synced = true
  Taro.setStorageSync(STORAGE_KEYS.RECORDS, records)
}
