const { HEALTH_MODULE_META } = require('../../../constants/modules')

const ALL_MODULES = Object.keys(HEALTH_MODULE_META).map(function (key) {
  return { key: key, label: HEALTH_MODULE_META[key].label, icon: HEALTH_MODULE_META[key].icon }
})

const REMINDER_TIMES = ['早', '中', '晚', '睡前']

Page({
  data: {
    modules: ALL_MODULES,
    config: {},
  },

  onLoad() {
    const saved = wx.getStorageSync('tracking_config') || {}
    const config = {}
    for (var i = 0; i < ALL_MODULES.length; i++) {
      var m = ALL_MODULES[i]
      config[m.key] = saved[m.key] || { enabled: true, reminderTimes: [] }
    }
    this.setData({ config })
    this.updateReminderMap()
  },

  updateReminderMap() {
    var map = {}
    var config = this.data.config
    for (var k in config) {
      var times = config[k].reminderTimes || []
      for (var i = 0; i < times.length; i++) {
        map[k + '_' + times[i]] = true
      }
    }
    this.setData({ reminderMap: map })
  },

  onToggle(e) {
    var key = e.currentTarget.dataset.key
    var config = {}
    for (var k in this.data.config) { config[k] = Object.assign({}, this.data.config[k]) }
    config[key].enabled = !config[key].enabled
    this.setData({ config })
    wx.setStorageSync('tracking_config', config)
  },

  onReminderToggle(e) {
    var key = e.currentTarget.dataset.key
    var time = e.currentTarget.dataset.time
    var config = {}
    for (var k in this.data.config) { config[k] = Object.assign({}, this.data.config[k]) }
    var times = config[key].reminderTimes
    var idx = times.indexOf(time)
    if (idx > -1) { times.splice(idx, 1) } else { times.push(time) }
    this.setData({ config })
    wx.setStorageSync('tracking_config', config)
    this.updateReminderMap()
  },
})
