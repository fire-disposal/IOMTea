const { api } = require('../../utils/api')

Page({
  data: {
    pins: [],
    loading: true,
  },

  onLoad() {
    const self = this
    api.get('/users/me')
      .then(function (me) {
        if (!me) {
          wx.redirectTo({ url: '/pages/login/index' })
          return
        }
        return api.get('/pins').then(function (pins) {
          var userPins = pins || []
          self.setData({ pins: userPins, loading: false })
        })
      })
      .catch(function () {
        wx.showToast({ title: '加载失败', icon: 'none' })
        self.setData({ loading: false })
      })
  },

  copyPin(e) {
    var pin = e.currentTarget.dataset.pin
    wx.setClipboardData({
      data: pin,
      success: function () {
        wx.showToast({ title: '已复制 PIN: ' + pin, icon: 'success' })
      },
    })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },
})
