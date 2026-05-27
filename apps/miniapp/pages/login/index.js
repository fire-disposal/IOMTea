const { api } = require('../../utils/api')
const { STORAGE_KEYS } = require('../../constants/storage-keys')

Page({
  data: { loading: false, iconBounce: false },

  onLoad() {
    // Trigger initial bounce
    setTimeout(() => this.setData({ iconBounce: true }), 300)
    setTimeout(() => this.setData({ iconBounce: false }), 1600)
  },

  onIconTap() {
    // Re-trigger bounce by briefly toggling the class
    this.setData({ iconBounce: false })
    setTimeout(() => this.setData({ iconBounce: true }), 50)
    setTimeout(() => this.setData({ iconBounce: false }), 1300)
  },

  handleWechatLogin() {
    this.setData({ loading: true })
    wx.login({
      success: (res) => {
        if (!res.code) {
          wx.showToast({ title: '登录失败', icon: 'none' })
          this.setData({ loading: false })
          return
        }
        api.post('/auth/wechat-login', { code: res.code })
          .then((data) => {
            wx.setStorageSync(STORAGE_KEYS.TOKEN, data.accessToken)
            wx.setStorageSync(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken)
            wx.setStorageSync(STORAGE_KEYS.USER_NAME, (data.user && data.user.displayName) || (data.user && data.user.username) || '')
            wx.setStorageSync(STORAGE_KEYS.USER_ID, (data.user && data.user.id) || '')
            wx.redirectTo({ url: '/pages/index/index' })
          })
          .catch(() => {
            wx.showToast({ title: '登录失败', icon: 'none' })
            this.setData({ loading: false })
          })
      },
      fail: () => {
        wx.showToast({ title: '登录失败', icon: 'none' })
        this.setData({ loading: false })
      },
    })
  },
})
