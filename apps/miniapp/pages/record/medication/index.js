const { api } = require('../../../utils/api')
const { STORAGE_KEYS } = require('../../../constants/storage-keys')
const { addLocalRecord } = require('../../../utils/storage')
const { syncUnsyncedRecords } = require('../../../utils/sync')

Page({
  data: {
    meds: [],
    loading: true,
    planId: '',
  },

  onLoad(options) {
    const planId = options.planId || ''
    this.setData({ planId })
    const token = wx.getStorageSync(STORAGE_KEYS.TOKEN)
    if (!token) {
      this.setData({ loading: false })
      return
    }
    const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
    api.get('/plans/today', { patientId })
      .then((plans) => {
        const medPlans = (plans || []).filter(
          (p) => p.code === 'medication' || p.code === 'medication_schedule',
        )
        const meds = medPlans.map((p) => ({
          id: p.id,
          drug: p.title,
          dosage: '',
          scheduled_time: '今日',
        }))
        this.setData({ meds, loading: false })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  handleTake(e) {
    const id = e.currentTarget.dataset.id
    const idx = parseInt(e.currentTarget.dataset.index)
    const med = this.data.meds[idx]
    const newMeds = [...this.data.meds]
    newMeds[idx] = { ...newMeds[idx], taken: true, skipped: false }
    this.setData({ meds: newMeds })

    addLocalRecord({
      type: 'medication',
      data: { drug: med.drug, dosage: med.dosage, scheduled_time: med.scheduled_time, action: 'taken' },
      recordedAt: new Date().toISOString(),
    })

    const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
    if (this.data.planId) {
      api.post('/plans/' + this.data.planId + '/complete', { patientId }).catch(() => {})
    }
    syncUnsyncedRecords()
    wx.vibrateShort()
    wx.showToast({ title: '已记录', icon: 'success' })
  },

  handleSkip(e) {
    const id = e.currentTarget.dataset.id
    const idx = parseInt(e.currentTarget.dataset.index)
    const med = this.data.meds[idx]
    const newMeds = [...this.data.meds]
    newMeds[idx] = { ...newMeds[idx], taken: false, skipped: true }
    this.setData({ meds: newMeds })

    addLocalRecord({
      type: 'medication',
      data: { drug: med.drug, dosage: med.dosage, scheduled_time: med.scheduled_time, action: 'skipped' },
      recordedAt: new Date().toISOString(),
    })

    const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
    if (this.data.planId) {
      api.post('/plans/' + this.data.planId + '/complete', { patientId }).catch(() => {})
    }
    syncUnsyncedRecords()
    wx.showToast({ title: '已跳过', icon: 'none' })
  },
})
