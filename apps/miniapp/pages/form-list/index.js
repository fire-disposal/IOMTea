const { api } = require('../../utils/api')

Page({
  data: {
    forms: [],
    loading: true,
  },

  onLoad() {
    api.get('/forms')
      .then(function (r) {
        var forms = (r || []).filter(function (f) { return f.status === 'published' })
        this.setData({ forms: forms, loading: false })
      }.bind(this))
      .catch(function () {
        this.setData({ loading: false })
      }.bind(this))
  },

  onFormTap(e) {
    var code = e.currentTarget.dataset.code
    wx.navigateTo({ url: '/pages/form/index?code=' + code })
  },
})
