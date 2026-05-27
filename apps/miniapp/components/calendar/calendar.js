var WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

Component({
  properties: {
    year: { type: Number, value: 2026 },
    month: { type: Number, value: 1 },
    activityData: { type: Object, value: {} }
  },

  data: {
    weekdays: WEEKDAYS,
    days: [],
    titleText: ''
  },

  observers: {
    'year, month, activityData': function (year, month, activityData) {
      this.buildDays(year, month, activityData || {})
    }
  },

  lifetimes: {
    attached: function () {
      this.buildDays(this.data.year, this.data.month, this.data.activityData || {})
    }
  },

  methods: {
    buildDays: function (year, month, activityData) {
      var firstDay = new Date(year, month - 1, 1).getDay()
      var daysInMonth = new Date(year, month, 0).getDate()
      var today = new Date()
      var todayStr = today.getFullYear() + '-' +
        this.pad(today.getMonth() + 1) + '-' +
        this.pad(today.getDate())

      var emptyCells = []
      for (var i = 0; i < firstDay; i++) {
        emptyCells.push({ day: 0, date: '', isToday: false, records: [], isEmpty: true })
      }

      var days = []
      for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = year + '-' + this.pad(month) + '-' + this.pad(d)
        days.push({
          day: d,
          date: dateStr,
          isToday: dateStr === todayStr,
          records: activityData[dateStr] || [],
          isEmpty: false
        })
      }

      var titleText = year + '年' + month + '月'

      this.setData({
        days: emptyCells.concat(days),
        titleText: titleText
      })
    },

    pad: function (n) {
      return n < 10 ? '0' + n : '' + n
    },

    prevMonth: function () {
      var m = this.data.month === 1 ? 12 : this.data.month - 1
      var y = this.data.month === 1 ? this.data.year - 1 : this.data.year
      this.triggerEvent('monthChange', { year: y, month: m })
    },

    nextMonth: function () {
      var m = this.data.month === 12 ? 1 : this.data.month + 1
      var y = this.data.month === 12 ? this.data.year + 1 : this.data.year
      this.triggerEvent('monthChange', { year: y, month: m })
    },

    handleDay: function (e) {
      var date = e.currentTarget.dataset.date
      if (!date) return
      this.triggerEvent('dayClick', { date: date })
    }
  }
})
