const { api } = require('../../utils/api')

Page({
  data: {
    patients: [],
    currentId: '',
  },

  onLoad() {
    this.setData({ currentId: wx.getStorageSync('patient_id') || '' })
    api.get('/patients/mine')
      .then(function (patients) {
        this.setData({ patients: patients || [] })
      }.bind(this))
      .catch(function () {})
  },

  onSelect(e) {
    var id = e.currentTarget.dataset.id
    wx.setStorageSync('patient_id', id)
    wx.showToast({ title: '已切换', icon: 'success' })
    setTimeout(function () { wx.navigateBack() }, 500)
  },
})
