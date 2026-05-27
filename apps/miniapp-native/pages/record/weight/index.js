const { api } = require('../../../utils/api')
const { STORAGE_KEYS } = require('../../../constants/storage-keys')
const { addLocalRecord, getTrendData } = require('../../../utils/storage')
const { syncUnsyncedRecords } = require('../../../utils/sync')

Page({
  data: {
    weight: '',
    showFat: 'no',
    bodyFat: '',
    saving: false,
    saved: false,
    trendData: [],
    toggleOptions: [
      { value: 'no', label: '仅体重' },
      { value: 'yes', label: '含体脂' },
    ],
    planId: '',
  },

  onLoad(options) {
    this.setData({ trendData: getTrendData('weight', 7), planId: options.planId || '' })
  },

  onWeightInput(e) { this.setData({ weight: e.detail.value }) },
  onBodyFatInput(e) { this.setData({ bodyFat: e.detail.value }) },
  onToggleTap(e) { this.setData({ showFat: e.currentTarget.dataset.value }) },

  handleSave() {
    if (!this.data.weight) {
      wx.showToast({ title: '请输入体重', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    addLocalRecord({
      type: 'weight',
      data: {
        weight_kg: Number(this.data.weight),
        body_fat_pct: this.data.showFat === 'yes' && this.data.bodyFat ? Number(this.data.bodyFat) : null,
      },
      recordedAt: new Date().toISOString(),
    })
    if (this.data.planId) {
      const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
      api.post('/plans/' + this.data.planId + '/complete', { patientId }).catch(() => {})
    }
    syncUnsyncedRecords()
    this.setData({ trendData: getTrendData('weight', 7) })
    wx.vibrateShort()
    this.setData({ saving: false, saved: true })
    setTimeout(() => wx.navigateBack(), 600)
  },
})
