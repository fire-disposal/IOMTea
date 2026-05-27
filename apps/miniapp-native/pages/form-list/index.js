const { api } = require('../../utils/api')

Page({
  data: {
    forms: [],
  },

  onLoad() {
    api.get('/forms')
      .then(function (r) {
        var forms = (r || []).filter(function (f) { return f.status === 'published' })
        this.setData({ forms: forms })
      }.bind(this))
      .catch(function () {})
  },

  onFormTap(e) {
    var code = e.currentTarget.dataset.code
    wx.navigateTo({ url: '/pages/form/index?code=' + code })
  },
})
