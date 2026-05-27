const STORAGE_KEYS = require('../constants/storage-keys').STORAGE_KEYS

const STORAGE_KEY = STORAGE_KEYS.RECORDS

function getLocalRecords(type) {
  const all = wx.getStorageSync(STORAGE_KEY) || []
  return type ? all.filter(r => r.type === type) : all
}

function addLocalRecord(record) {
  const all = getLocalRecords()
  const newRecord = Object.assign({}, record, {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    synced: false
  })
  all.push(newRecord)
  wx.setStorageSync(STORAGE_KEY, all)
  return newRecord
}

function markSynced(ids) {
  const all = getLocalRecords()
  for (const record of all) {
    if (ids.includes(record.id)) record.synced = true
  }
  wx.setStorageSync(STORAGE_KEY, all)
}

function getUnsyncedRecords() {
  return getLocalRecords().filter(r => !r.synced)
}

function getTrendData(type, days) {
  const d = days || 7
  const records = getLocalRecords(type)
  const cutoff = Date.now() - d * 24 * 60 * 60 * 1000
  const filtered = records
    .filter(r => new Date(r.recordedAt).getTime() > cutoff)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .slice(-d)

  return filtered.map(r => ({
    date: r.recordedAt.slice(0, 10),
    value: extractPrimaryValue(r)
  }))
}

function extractPrimaryValue(record) {
  switch (record.type) {
    case 'blood_glucose':
      return record.data.value_mgdl
    case 'blood_pressure':
      return record.data.systolic
    case 'weight':
      return record.data.weight_kg
    case 'heart_rate':
      return record.data.bpm
    case 'temperature':
      return record.data.celsius
    case 'spo2':
      return record.data.percentage
    default:
      return 0
  }
}

module.exports = { getLocalRecords, addLocalRecord, markSynced, getUnsyncedRecords, getTrendData }
