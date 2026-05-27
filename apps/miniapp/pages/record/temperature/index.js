const { api } = require('../../../utils/api')
const { STORAGE_KEYS } = require('../../../constants/storage-keys')
const { addLocalRecord, getTrendData } = require('../../../utils/storage')
const { syncUnsyncedRecords } = require('../../../utils/sync')

Page({
  data: {
    value: '',
    saving: false,
    saved: false,
    trendData: [],
    planId: '',
  },

  onLoad(options) {
    this.setData({ trendData: getTrendData('temperature', 7), planId: options.planId || '' })
  },

  onValueInput(e) { this.setData({ value: e.detail.value }) },

  handleSave() {
    if (!this.data.value || Number(this.data.value) <= 0) {
      wx.showToast({ title: '请输入体温', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    addLocalRecord({
      type: 'temperature',
      data: { celsius: Number(this.data.value) },
      recordedAt: new Date().toISOString(),
    })
    if (this.data.planId) {
      const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
      api.post('/plans/' + this.data.planId + '/complete', { patientId }).catch(() => {})
    }
    syncUnsyncedRecords()
    this.setData({ trendData: getTrendData('temperature', 7) })
    wx.vibrateShort()
    this.setData({ saving: false, saved: true })
    setTimeout(() => wx.navigateBack(), 600)
  },
})
