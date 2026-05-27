const { api } = require('../../utils/api')
const { STORAGE_KEYS } = require('../../constants/storage-keys')
const { HEALTH_MODULE_KEYS, HEALTH_MODULE_META } = require('../../constants/modules')

Page({
  data: {
    items: {},
    modules: HEALTH_MODULE_KEYS,
    saving: false,
  },

  onLoad() {
    var cached = wx.getStorageSync(STORAGE_KEYS.PLAN_CACHE)
    var plan = cached || null
    var items = {}
    if (plan && plan.items) {
      for (var i = 0; i < plan.items.length; i++) {
        var item = plan.items[i]
        items[item.moduleKey] = {
          moduleKey: item.moduleKey,
          enabled: item.enabled,
          reminderEnabled: item.reminderEnabled,
        }
      }
    }
    for (var j = 0; j < HEALTH_MODULE_KEYS.length; j++) {
      var key = HEALTH_MODULE_KEYS[j]
      if (!items[key]) {
        items[key] = { moduleKey: key, enabled: false, reminderEnabled: false }
      }
    }
    this.setData({ items: items })
  },

  onToggle(e) {
    var key = e.currentTarget.dataset.key
    var items = this.data.items
    items[key].enabled = !items[key].enabled
    this.setData({ items: items })
  },

  onDetailTap(e) {
    var key = e.currentTarget.dataset.key
    wx.navigateTo({ url: '/pages/plan/detail/index?moduleKey=' + key })
  },

  handleSave() {
    this.setData({ saving: true })
    var items = this.data.items
    var input = []
    var orderIdx = 0
    for (var i = 0; i < HEALTH_MODULE_KEYS.length; i++) {
      var k = HEALTH_MODULE_KEYS[i]
      if (items[k] && items[k].enabled) {
        input.push({
          moduleKey: k,
          enabled: true,
          reminderEnabled: items[k].reminderEnabled,
          reminderTimes: [],
          frequency: 'daily',
          sortOrder: orderIdx++,
        })
      }
    }

    wx.setStorageSync(STORAGE_KEYS.PLAN_CACHE, { items: input })
    wx.showToast({ title: '已保存', icon: 'success' })
    this.setData({ saving: false })
    setTimeout(function () {
      wx.switchTab({ url: '/pages/index/index' })
    }, 800)
  },
})
