const { STORAGE_KEYS } = require('../constants/storage-keys')
const { api } = require('./api')

function syncUnsyncedRecords() {
  const records = wx.getStorageSync(STORAGE_KEYS.RECORDS) || []
  const unsynced = records.filter(function (r) { return !r.synced })
  if (unsynced.length === 0) return Promise.resolve()

  const events = unsynced.map(function (r) {
    var metric = r.type
    var value = r.data
    if (r.type === 'blood_glucose') {
      metric = 'glucose'
      value = r.data.value_mgdl != null ? r.data.value_mgdl : Number(r.data.value)
    } else if (r.type === 'blood_pressure') {
      metric = 'systolic_bp'
      value = Number(r.data.systolic)
    } else if (r.type === 'weight') {
      metric = 'weight'
    } else if (r.type === 'medication') {
      metric = 'medication'
      value = r.data
    } else if (r.type === 'period') {
      metric = 'period'
      value = r.data
    }
    return {
      patientId: wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || '',
      kind: 'observation',
      metric: metric,
      source: 'manual',
      value: typeof value === 'number' ? value : (value || 0),
      recordedAt: r.recordedAt || new Date().toISOString(),
    }
  })

  return api.post('/ingest/batch', { events: events }).then(function () {
    for (var i = 0; i < unsynced.length; i++) {
      unsynced[i].synced = true
    }
    wx.setStorageSync(STORAGE_KEYS.RECORDS, records)
  })
}

function startAutoSync() {
  return setInterval(syncUnsyncedRecords, 5 * 60 * 1000)
}

module.exports = { syncUnsyncedRecords, startAutoSync }
