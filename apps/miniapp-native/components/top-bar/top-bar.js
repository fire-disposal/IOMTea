var AVATAR_COLORS = [
  ['#6BA539', '#8EC15B'],
  ['#4A90D9', '#74B9FF'],
  ['#E67E22', '#F0A04B'],
  ['#9B59B6', '#BB8FCE'],
  ['#1ABC9C', '#48C9B0'],
]

Component({
  properties: {
    displayName: { type: String, value: '' },
    credit: { type: Number, value: 0 }
  },

  data: {
    avatarChar: '用',
    avatarGradient: 'linear-gradient(135deg, #6BA539, #8EC15B)'
  },

  observers: {
    'displayName': function (name) {
      var display = name || '用'
      var idx = display.charCodeAt(0) % AVATAR_COLORS.length
      var gradient = AVATAR_COLORS[idx]
      this.setData({
        avatarChar: display[0],
        avatarGradient: 'linear-gradient(135deg, ' + gradient[0] + ', ' + gradient[1] + ')'
      })
    }
  },

  methods: {
    goProfile: function () {
      wx.switchTab({ url: '/pages/profile/index' })
    },
    goCredit: function () {
      wx.navigateTo({ url: '/pages/credit/index' })
    }
  }
})
