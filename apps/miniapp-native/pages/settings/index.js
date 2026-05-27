const { api } = require('../../utils/api')
const { STORAGE_KEYS } = require('../../constants/storage-keys')

Page({
  data: {
    serverUrl: '',
  },

  onLoad() {
    this.setData({
      serverUrl: wx.getStorageSync(STORAGE_KEYS.SERVER_URL) || 'http://localhost:3000',
    })
  },

  onUrlInput(e) {
    this.setData({ serverUrl: e.detail.value })
  },

  save() {
    wx.setStorageSync(STORAGE_KEYS.SERVER_URL, this.data.serverUrl)
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  testConn() {
    api.get('/users/me')
      .then((r) => {
        wx.showToast({ title: '连接成功: ' + ((r && r.displayName) || 'OK'), icon: 'success' })
      })
      .catch(() => {
        wx.showToast({ title: '连接失败', icon: 'error' })
      })
  },

  logout() {
    wx.removeStorageSync(STORAGE_KEYS.TOKEN)
    wx.removeStorageSync(STORAGE_KEYS.REFRESH_TOKEN)
    wx.redirectTo({ url: '/pages/login/index' })
  },
})
