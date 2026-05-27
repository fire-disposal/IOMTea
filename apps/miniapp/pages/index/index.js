const { api } = require('../../utils/api')
const { STORAGE_KEYS } = require('../../constants/storage-keys')
const { getRecordPage } = require('../../constants/modules')

Page({
  data: {
    plans: [],
    credit: 0,
    loading: true,
    userName: '',
  },

  onLoad() {
    const token = wx.getStorageSync(STORAGE_KEYS.TOKEN)
    if (!token) {
      wx.redirectTo({ url: '/pages/login/index' })
      return
    }
    const userName = wx.getStorageSync(STORAGE_KEYS.USER_NAME) || '用户'
    const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''

    this.setData({ userName })

    Promise.all([
      api.get('/plans/today', { patientId }),
      api.get('/users/me'),
    ])
      .then(([today, me]) => {
        const plans = today || []
        const credit = me ? (me.credit || 0) : 0
        this.setData({ plans, credit, loading: false })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  onShow() {
    const userName = wx.getStorageSync(STORAGE_KEYS.USER_NAME) || '用户'
    const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
    this.setData({ userName })
    api.get('/plans/today', { patientId })
      .then((today) => {
        this.setData({ plans: today || [] })
      })
      .catch(() => {})
  },

  onPlanTap(e) {
    const recordPage = e.currentTarget.dataset.page
    if (recordPage) {
      wx.navigateTo({ url: recordPage })
    }
  },

  onGoPlan() {
    wx.navigateTo({ url: '/pages/plan/index' })
  },
})
