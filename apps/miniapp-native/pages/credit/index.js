const { api } = require('../../utils/api')
const { HEALTH_MODULE_META } = require('../../constants/modules')

Page({
  data: {
    transactions: [],
    balance: 0,
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
