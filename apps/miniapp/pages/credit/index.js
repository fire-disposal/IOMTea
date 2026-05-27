const { api } = require('../../utils/api')
const { HEALTH_MODULE_META } = require('../../constants/modules')

Page({
  data: {
    balance: 0, transactions: [], loading: true,
  },

  onLoad() {
    const userId = wx.getStorageSync(STORAGE_KEYS.USER_ID) || ''
    Promise.all([
      api.get('/credits/balance'),
      api.get('/credits/transactions', { userId, pageSize: 50 }),
    ])
      .then(([bal, txs]) => {
        this.setData({ balance: bal ? bal.balance : 0, transactions: txs || [], loading: false })
      })
      .catch(() => {
        this.setData({ loading: false })
      })
  },

  onBack() {
    wx.navigateBack()
  },

  onLoad() {
    Promise.all([
      api.get('/credits/balance'),
      api.get('/credits/transactions', { page: 1, pageSize: 50 }),
    ])
      .then(function (results) {
        var bal = results[0]
        var txns = results[1]
        this.setData({
          balance: bal ? bal.balance : 0,
          transactions: txns || [],
        })
      }.bind(this))
      .catch(function () {})
  },

  getModuleMeta(moduleKey) {
    return HEALTH_MODULE_META[moduleKey] || null
  },
})
