const { api } = require('../../../utils/api')
const { STORAGE_KEYS } = require('../../../constants/storage-keys')
const { addLocalRecord, getTrendData } = require('../../../utils/storage')
const { syncUnsyncedRecords } = require('../../../utils/sync')

Page({
  data: {
    systolic: '',
    diastolic: '',
    heartRate: '',
    saving: false,
    saved: false,
    trendData: [],
    planId: '',
  },

  onLoad(options) {
    this.setData({ trendData: getTrendData('blood_pressure', 7), planId: options.planId || '' })
  },

  onSystolicInput(e) { this.setData({ systolic: e.detail.value }) },
  onDiastolicInput(e) { this.setData({ diastolic: e.detail.value }) },
  onHeartRateInput(e) { this.setData({ heartRate: e.detail.value }) },

  handleSave() {
    if (!this.data.systolic || !this.data.diastolic) {
      wx.showToast({ title: '请输入收缩压和舒张压', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    addLocalRecord({
      type: 'blood_pressure',
      data: {
        systolic: Number(this.data.systolic),
        diastolic: Number(this.data.diastolic),
        heart_rate: this.data.heartRate ? Number(this.data.heartRate) : null,
      },
      recordedAt: new Date().toISOString(),
    })
    if (this.data.planId) {
      const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
      api.post('/plans/' + this.data.planId + '/complete', { patientId }).catch(() => {})
    }
    syncUnsyncedRecords()
    this.setData({ trendData: getTrendData('blood_pressure', 7) })
    wx.vibrateShort()
    this.setData({ saving: false, saved: true })
    setTimeout(() => wx.navigateBack(), 600)
  },
})
