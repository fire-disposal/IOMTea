const { api } = require('../../../utils/api')
const { STORAGE_KEYS } = require('../../../constants/storage-keys')
const { addLocalRecord, getTrendData } = require('../../../utils/storage')
const { syncUnsyncedRecords } = require('../../../utils/sync')

Page({
  data: {
    value: '',
    context: 'fasting',
    mealTag: '',
    saving: false,
    saved: false,
    trendData: [],
    contextOptions: [
      { value: 'fasting', label: '空腹' },
      { value: 'postprandial', label: '餐后' },
      { value: 'bedtime', label: '睡前' },
      { value: 'random', label: '随机' },
    ],
    mealOptions: [
      { value: 'breakfast', label: '早餐' },
      { value: 'lunch', label: '午餐' },
      { value: 'dinner', label: '晚餐' },
      { value: 'snack', label: '加餐' },
    ],
    planId: '',
  },

  onLoad(options) {
    this.setData({ trendData: getTrendData('blood_glucose', 7), planId: options.planId || '' })
  },

  onValueInput(e) {
    this.setData({ value: e.detail.value })
  },

  onContextTap(e) {
    this.setData({ context: e.currentTarget.dataset.value })
    if (e.currentTarget.dataset.value !== 'postprandial') {
      this.setData({ mealTag: '' })
    }
  },

  onMealTap(e) {
    this.setData({ mealTag: e.currentTarget.dataset.value })
  },

  handleSave() {
    if (!this.data.value || Number(this.data.value) <= 0) {
      wx.showToast({ title: '请输入血糖值', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    addLocalRecord({
      type: 'blood_glucose',
      data: {
        value_mgdl: Number(this.data.value),
        context: this.data.context,
        meal_tag: this.data.mealTag || null,
      },
      recordedAt: new Date().toISOString(),
    })
    if (this.data.planId) {
      const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
      api.post('/plans/' + this.data.planId + '/complete', { patientId }).catch(() => {})
    }
    syncUnsyncedRecords()
    this.setData({ trendData: getTrendData('blood_glucose', 7) })
    wx.vibrateShort()
    this.setData({ saving: false, saved: true })
    setTimeout(() => wx.navigateBack(), 600)
  },
})
