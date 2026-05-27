const { syncUnsyncedRecords, startAutoSync } = require('./utils/sync')

App({
  globalData: { syncTimer: null, devMode: false },

  onLaunch() {
    this.globalData.devMode = wx.getStorageSync('dev_mode') === true

    const token = wx.getStorageSync('token')
    if (!token) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    if (!this.globalData.devMode) {
      this.globalData.syncTimer = startAutoSync()
      syncUnsyncedRecords()
    }
  },

  onHide() {
    if (this.globalData?.syncTimer) {
      clearInterval(this.globalData.syncTimer)
    }
  },

  onShow() {
    if (!this.globalData.devMode) {
      syncUnsyncedRecords()
      this.globalData.syncTimer = startAutoSync()
    }
  }
})
