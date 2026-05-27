const { api } = require('../../utils/api')
const { STORAGE_KEYS } = require('../../constants/storage-keys')

Page({
  data: {
    credit: 0,
    user: { displayName: null, username: '' },
    recordCount: 0,
  },

  onLoad() {
    api.get('/users/me')
      .then((me) => {
        if (me) {
          this.setData({
            credit: me.credit || 0,
            user: { displayName: me.displayName, username: me.username },
          })
        }
      })
      .catch(() => {})
    const records = wx.getStorageSync(STORAGE_KEYS.RECORDS) || []
    this.setData({ recordCount: records.length })
  },

  onShow() {
    const records = wx.getStorageSync(STORAGE_KEYS.RECORDS) || []
    this.setData({ recordCount: records.length })
  },

  handleSync() {
    const records = wx.getStorageSync(STORAGE_KEYS.RECORDS) || []
    const unsynced = records.filter((r) => !r.synced)
    if (unsynced.length === 0) {
      wx.showToast({ title: '已全部同步', icon: 'none' })
      return
    }
    api.post('/ingest/batch', { events: unsynced })
      .then(() => {
        wx.showToast({ title: '同步 ' + unsynced.length + ' 条成功', icon: 'none' })
      })
      .catch(() => {
        wx.showToast({ title: '同步失败', icon: 'none' })
      })
  },

  handleLogout() {
    wx.removeStorageSync(STORAGE_KEYS.TOKEN)
    wx.reLaunch({ url: '/pages/login/index' })
  },

  onNavigate(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.navigateTo({ url })
  },
})
