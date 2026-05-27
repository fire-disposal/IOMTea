const STORAGE_KEYS = require('../constants/storage-keys').STORAGE_KEYS
const { api } = require('./api')

async function syncUnsyncedRecords() {
  const records = wx.getStorageSync(STORAGE_KEYS.RECORDS) || []
  const unsynced = records.filter(r => !r.synced)
  if (unsynced.length === 0) return

  const events = unsynced.map(r => {
    let metric = r.type
    let value = r.data
    if (r.type === 'blood_glucose') {
      metric = 'glucose'
      value = r.data.value_mgdl != null ? r.data.value_mgdl : Number(r.data.value)
    } else if (r.type === 'blood_pressure') {
      metric = 'systolic_bp'
      value = Number(r.data.systolic)
    } else if (r.type === 'weight') metric = 'weight'
    else if (r.type === 'medication') {
      metric = 'medication'
      value = r.data
    } else if (r.type === 'period') {
      metric = 'period'
      value = r.data
    }
    return {
      patientId: wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || '',
      kind: 'observation',
      metric,
      source: 'manual',
      value: typeof value === 'number' ? value : (value != null ? value : 0),
      recordedAt: r.recordedAt || new Date().toISOString()
    }
  })

  await api.post('/ingest/batch', { events })
  for (const r of unsynced) r.synced = true
  wx.setStorageSync(STORAGE_KEYS.RECORDS, records)
}

function startAutoSync() {
  return setInterval(syncUnsyncedRecords, 5 * 60 * 1000)
}

module.exports = { syncUnsyncedRecords, startAutoSync }
