const { syncUnsyncedRecords, startAutoSync } = require('./utils/sync')

App({
  globalData: { syncTimer: null },

  onLaunch() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    this.globalData.syncTimer = startAutoSync()
    syncUnsyncedRecords()
  },

  onHide() {
    if (this.globalData?.syncTimer) {
      clearInterval(this.globalData.syncTimer)
    }
  },

  onShow() {
    syncUnsyncedRecords()
    this.globalData.syncTimer = startAutoSync()
  }
})
