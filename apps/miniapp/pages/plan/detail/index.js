const { STORAGE_KEYS } = require('../../../constants/storage-keys')
const { HEALTH_MODULE_META } = require('../../../constants/modules')

const DEFAULT_SLOTS = [
  { label: '早晨', hour: 8, min: 0, enabled: false },
  { label: '中午', hour: 12, min: 30, enabled: false },
  { label: '晚上', hour: 18, min: 0, enabled: false },
  { label: '睡前', hour: 22, min: 0, enabled: false },
]

Page({
  data: {
    moduleKey: '',
    meta: {},
    slots: DEFAULT_SLOTS,
    frequency: 'daily',
    saving: false,
  },

  onLoad(options) {
    var moduleKey = options.moduleKey || ''
    var meta = HEALTH_MODULE_META[moduleKey] || { label: '', icon: '' }
    this.setData({ moduleKey: moduleKey, meta: meta })

    var cached = wx.getStorageSync(STORAGE_KEYS.PLAN_CACHE)
    if (cached && cached.items) {
      var items = cached.items
      for (var i = 0; i < items.length; i++) {
        if (items[i].moduleKey === moduleKey) {
          var item = items[i]
          this.setData({ frequency: item.frequency || 'daily' })
          if (item.reminderTimes && item.reminderTimes.length > 0) {
            var loaded = item.reminderTimes.map(function (t, j) {
              return {
                label: DEFAULT_SLOTS[j] ? DEFAULT_SLOTS[j].label : '时段' + (j + 1),
                hour: t.hour,
                min: t.min,
                enabled: true,
              }
            })
            while (loaded.length < DEFAULT_SLOTS.length) {
              loaded.push(Object.assign({}, DEFAULT_SLOTS[loaded.length]))
            }
            this.setData({ slots: loaded })
          }
          break
        }
      }
    }
  },

  onSlotToggle(e) {
    var idx = parseInt(e.currentTarget.dataset.index)
    var slots = this.data.slots.slice()
    slots[idx].enabled = !slots[idx].enabled
    this.setData({ slots: slots })
  },

  onTimeChange(e) {
    var idx = parseInt(e.currentTarget.dataset.index)
    var val = e.detail.value
    var parts = val.split(':')
    var h = parseInt(parts[0])
    var m = parseInt(parts[1])
    var slots = this.data.slots.slice()
    slots[idx].hour = h
    slots[idx].min = m
    this.setData({ slots: slots })
  },

  handleSave() {
    this.setData({ saving: true })
    var enabledSlots = this.data.slots.filter(function (s) { return s.enabled })
    var moduleKey = this.data.moduleKey

    var cached = wx.getStorageSync(STORAGE_KEYS.PLAN_CACHE) || { items: [] }
    var currentItems = (cached.items || []).map(function (i) {
      return {
        moduleKey: i.moduleKey,
        enabled: i.enabled,
        reminderEnabled: i.moduleKey === moduleKey ? enabledSlots.length > 0 : i.reminderEnabled,
        reminderTimes: i.moduleKey === moduleKey
          ? enabledSlots.map(function (s) { return { hour: s.hour, min: s.min } })
          : i.reminderTimes,
        frequency: i.moduleKey === moduleKey ? this.data.frequency : i.frequency,
        sortOrder: i.sortOrder,
      }
    })
    wx.setStorageSync(STORAGE_KEYS.PLAN_CACHE, { items: currentItems })

    wx.showToast({ title: '已保存', icon: 'success' })
    this.setData({ saving: false })
    setTimeout(function () {
      wx.navigateBack()
    }, 600)
  },
})
