const { syncUnsyncedRecords, startAutoSync } = require('./utils/sync')

App({
  onLaunch() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    const syncTimer = startAutoSync()
    this.globalData = { syncTimer }
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
