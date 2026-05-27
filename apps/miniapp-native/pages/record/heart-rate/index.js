const { api } = require('../../../utils/api')
const { STORAGE_KEYS } = require('../../../constants/storage-keys')
const { addLocalRecord, getTrendData } = require('../../../utils/storage')
const { syncUnsyncedRecords } = require('../../../utils/sync')

Page({
  data: {
    value: '',
    context: 'resting',
    saving: false,
    saved: false,
    trendData: [],
    contextOptions: [
      { value: 'resting', label: '静息' },
      { value: 'after_exercise', label: '运动后' },
      { value: 'random', label: '随机' },
    ],
    planId: '',
  },

  onLoad(options) {
    this.setData({ trendData: getTrendData('heart_rate', 7), planId: options.planId || '' })
  },

  onValueInput(e) { this.setData({ value: e.detail.value }) },
  onContextTap(e) { this.setData({ context: e.currentTarget.dataset.value }) },

  handleSave() {
    if (!this.data.value || Number(this.data.value) <= 0) {
      wx.showToast({ title: '请输入心率', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    addLocalRecord({
      type: 'heart_rate',
      data: { bpm: Number(this.data.value), context: this.data.context },
      recordedAt: new Date().toISOString(),
    })
    if (this.data.planId) {
      const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
      api.post('/plans/' + this.data.planId + '/complete', { patientId }).catch(() => {})
    }
    syncUnsyncedRecords()
    this.setData({ trendData: getTrendData('heart_rate', 7) })
    wx.vibrateShort()
    this.setData({ saving: false, saved: true })
    setTimeout(() => wx.navigateBack(), 600)
  },
})
