const { HEALTH_MODULE_KEYS, HEALTH_MODULE_META, getRecordPage } = require('../../constants/modules')
const { getLocalRecords } = require('../../utils/storage')

Page({
  data: {
    counts: {},
    activityData: {},
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth() + 1,
    calVisible: false,
    loaded: false,
    modules: [],
    monthLabel: '',
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],
    activeDates: [],
    totalToday: 0,
    activeModules: 0,
  },

  onLoad() {
    this.refreshData()
    this.buildCalendar()
  },

  onShow() {
    this.refreshData()
  },

  refreshData() {
    const trackingConfig = wx.getStorageSync('tracking_config') || {}
    const modules = HEALTH_MODULE_KEYS
      .filter((k) => trackingConfig[k] ? trackingConfig[k].enabled !== false : true)
      .map((k) => ({
        key: k,
        label: HEALTH_MODULE_META[k].label,
        unit: HEALTH_MODULE_META[k].unit,
        icon: HEALTH_MODULE_META[k].icon,
        page: getRecordPage(k),
      }))

    const all = getLocalRecords()
    const today = new Date().toISOString().slice(0, 10)
    const counts = {}
    const activityData = {}
    for (let i = 0; i < all.length; i++) {
      const r = all[i]
      counts[r.type] = (counts[r.type] || 0) + (r.recordedAt.startsWith(today) ? 1 : 0)
      const date = r.recordedAt.slice(0, 10)
      if (!activityData[date]) activityData[date] = []
      if (activityData[date].indexOf(r.type) === -1) activityData[date].push(r.type)
    }

    let totalToday = 0
    let activeModules = 0
    for (const k of Object.keys(counts)) {
      totalToday += counts[k]
      if (counts[k] > 0) activeModules++
    }

    this.setData({ counts, activityData, modules, totalToday, activeModules, loaded: true })
    this.buildCalendar()
  },

  buildCalendar() {
    const year = this.data.calYear
    const month = this.data.calMonth
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const startDow = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
    const days = []
    for (let i = 0; i < startDow; i++) days.push({ day: '', active: false, count: 0 })
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const count = (this.data.activityData[dateStr] || []).length
      days.push({ day: d, active: count > 0, count })
    }

    this.setData({
      monthLabel: months[month - 1] + ' ' + year,
      calendarDays: days,
    })
  },

  onPrevMonth() {
    if (this.data.calMonth === 1) {
      this.setData({ calYear: this.data.calYear - 1, calMonth: 12 })
    } else {
      this.setData({ calMonth: this.data.calMonth - 1 })
    }
    this.buildCalendar()
  },

  onNextMonth() {
    if (this.data.calMonth === 12) {
      this.setData({ calYear: this.data.calYear + 1, calMonth: 1 })
    } else {
      this.setData({ calMonth: this.data.calMonth + 1 })
    }
    this.buildCalendar()
  },

  onToggleCal() {
    this.setData({ calVisible: !this.data.calVisible })
  },

  onDayTap(e) {
    const date = e.currentTarget.dataset.date
    const count = e.currentTarget.dataset.count
    if (date) {
      wx.showModal({
        title: date,
        content: count + ' 条记录',
        showCancel: false,
      })
    }
  },

  onModuleTap(e) {
    const page = e.currentTarget.dataset.page
    if (page) wx.navigateTo({ url: page })
  },

  onFormListTap() {
    wx.navigateTo({ url: '/pages/form-list/index' })
  },

  onRecordsTap() {
    wx.navigateTo({ url: '/pages/records/index' })
  },

  onTrackingTap() {
    wx.navigateTo({ url: '/pages/settings/tracking/index' })
  },
})
