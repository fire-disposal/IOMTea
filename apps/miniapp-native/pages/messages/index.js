const { api } = require('../../utils/api')

Page({
  data: {
    alerts: [],
    loading: true,
  },

  onLoad() {
    api.get('/alerts', { pageSize: 50 })
      .then((r) => {
        this.setData({ alerts: r || [], loading: false })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  onShow() {
    api.get('/alerts', { pageSize: 50 })
      .then((r) => {
        this.setData({ alerts: r || [] })
      })
      .catch(() => {})
  },

  onAlertTap() {
    wx.navigateTo({ url: '/pages/alerts/index' })
  },
})
