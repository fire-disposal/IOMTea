const { api } = require('../../utils/api')
const { STORAGE_KEYS } = require('../../constants/storage-keys')

Page({
  data: { loading: false, iconBounce: false, tapCount: 0 },

  onLoad() {
    setTimeout(() => this.setData({ iconBounce: true }), 300)
    setTimeout(() => this.setData({ iconBounce: false }), 1600)
  },

  onIconTap() {
    this.setData({ iconBounce: false })
    setTimeout(() => this.setData({ iconBounce: true }), 50)
    setTimeout(() => this.setData({ iconBounce: false }), 1300)

    var count = this.data.tapCount + 1
    if (count >= 5) {
      this.setData({ tapCount: 0 })
      wx.setStorageSync('dev_mode', true)
      wx.setStorageSync('token', 'dev-token')
      wx.setStorageSync('user_name', '开发者')
      wx.setStorageSync('user_id', 'dev-user-001')
      wx.setStorageSync('patient_id', 'dev-patient-001')
      wx.showModal({
        title: '开发者模式已激活',
        content: '所有数据均为本地模拟，不会发送至服务器。可在首页顶部退出。',
        showCancel: false,
        confirmText: '进入',
        success: function () {
          wx.redirectTo({ url: '/pages/index/index' })
        }
      })
      return
    }
    this.setData({ tapCount: count })
    clearTimeout(this._tapTimer)
    this._tapTimer = setTimeout(function () { this.setData({ tapCount: 0 }) }.bind(this), 3000)
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
