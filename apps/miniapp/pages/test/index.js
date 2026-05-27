var COL_CFG = [
  { id: 'metric', label: '指标', type: 'picker', options: [
    { value: 'blood_glucose', label: '血糖' }, { value: 'blood_pressure', label: '血压' },
    { value: 'heart_rate', label: '心率' }, { value: 'weight', label: '体重' },
    { value: 'temperature', label: '体温' }, { value: 'spo2', label: '血氧' }
  ]},
  { id: 'value', label: '数值', type: 'dial', defaultValue: 5.5, step: 0.1, min: 1.0, max: 30.0, unit: 'mmol/L', decimal: 1,
    rangesByMetric: {
      blood_glucose:     { min: 1.0, max: 30.0, unit: 'mmol/L', step: 0.1, decimal: 1 },
      blood_pressure:    { min: 60, max: 250, unit: 'mmHg', step: 1, decimal: 0 },
      heart_rate:        { min: 30, max: 220, unit: 'bpm', step: 1, decimal: 0 },
      weight:            { min: 20, max: 300, unit: 'kg', step: 0.5, decimal: 1 },
      temperature:       { min: 34.0, max: 43.0, unit: '°C', step: 0.1, decimal: 1 },
      spo2:              { min: 50, max: 100, unit: '%', step: 1, decimal: 0 }
    }
  },
  { id: 'context', label: '场景', type: 'picker', options: [
    { value: 'fasting', label: '空腹' }, { value: 'postprandial', label: '餐后' },
    { value: 'bedtime', label: '睡前' }, { value: 'random', label: '随机' }
  ]}
]

var CANCEL_W = 70, SUBMIT_W = 80, OPT_H = 72, PICKER_COL_W = 190, DIAL_COL_W = 260

/** Speed zones relative to dial height, as fraction from top */
var ZONES = [
  { name: 'fastUp',    from: 0.00, to: 0.15, speed: +5, desc: '快速增加' },
  { name: 'slowUp',    from: 0.15, to: 0.38, speed: +0.5, desc: '缓慢增加' },
  { name: 'center',    from: 0.38, to: 0.62, speed: 0, desc: '保持' },
  { name: 'slowDown',  from: 0.62, to: 0.85, speed: -0.5, desc: '缓慢减少' },
  { name: 'fastDown',  from: 0.85, to: 1.00, speed: -5, desc: '快速减少' },
]

function buildColumns() {
  return COL_CFG.map(function (c) {
    var col = {
      id: c.id, label: c.label, type: c.type, options: c.options,
      active: false, done: false, revisiting: false,
      selectedIdx: -1, selectedLabel: '', highlightIdx: -1,
    }
    if (c.type === 'dial') {
      col.defaultValue = c.defaultValue; col.currentValue = c.defaultValue
      col.step = c.step; col.min = c.min; col.max = c.max
      col.unit = c.unit; col.decimal = c.decimal; col.rangesByMetric = c.rangesByMetric
    }
    return col
  })
}

Page({
  data: {
    columns: buildColumns(),
    activeColumn: -1, inCancelZone: false, inSubmitZone: false,
    path: [], done: false, cancelled: false,
    displayValue: '', dialZone: '', dialActive: false, dialInfo: '',
  },

  dialLastY: 0, dialTimer: null, dialRect: null, canvasRect: null,

  onLoad() {
    var self = this
    this._load = true
    wx.createSelectorQuery().select('.test-canvas').boundingClientRect()
      .exec(function (res) { if (res[0]) self.canvasRect = res[0] })
  },

  colX(x) {
    var l = this.canvasRect ? this.canvasRect.left : 0
    var dx = x - l - CANCEL_W
    if (dx < 0) return -2 // cancel zone
    if (dx < PICKER_COL_W) return 0  // col 1
    if (dx < PICKER_COL_W + DIAL_COL_W) return 1 // col 2 (dial)
    if (dx < PICKER_COL_W + DIAL_COL_W + PICKER_COL_W) return 2 // col 3
    return 99 // submit zone
  },

  stopDial() {
    if (this.dialTimer) { clearInterval(this.dialTimer); this.dialTimer = null }
    this.setData({ dialActive: false, dialZone: '', dialInfo: '' })
  },

  startDial(val) {
    this.stopDial()
    this.setData({ dialActive: true, displayValue: val.toFixed(COL_CFG[1].decimal || 1) })
  },

  updateDialRange(metricKey) {
    var col = this.data.columns.slice()
    var cfg = COL_CFG[1]
    var range = (cfg.rangesByMetric && cfg.rangesByMetric[metricKey]) || { min: cfg.min, max: cfg.max, unit: cfg.unit, step: cfg.step, decimal: cfg.decimal }
    col[1].min = range.min
    col[1].max = range.max
    col[1].unit = range.unit
    col[1].step = range.step
    col[1].decimal = range.decimal
    col[1].currentValue = ((range.min + range.max) / 2).toFixed(range.decimal)
    col[1].selectedLabel = String(col[1].currentValue)
    this.setData({ columns: col, displayValue: col[1].currentValue })
  },

  onDialMove(y) {
    var col = this.data.columns[1]
    if (!this.dialRect) {
      var self = this
      wx.createSelectorQuery().select('.test-dial').boundingClientRect()
        .exec(function (res) { if (res[0]) self.dialRect = res[0] })
      return
    }
    var h = this.dialRect.height
    var dy = y - this.dialRect.top
    var frac = dy / h
    if (frac < 0) frac = 0; if (frac > 1) frac = 1

    var zone = null
    for (var i = 0; i < ZONES.length; i++) {
      if (frac >= ZONES[i].from && frac <= ZONES[i].to) { zone = ZONES[i]; break }
    }
    if (!zone) return

    this.setData({ dialZone: zone.name, dialInfo: zone.desc })
    this.stopDial()

    if (zone.speed !== 0) {
      var self = this
      this.dialTimer = setInterval(function () {
        var c = self.data.columns.slice()
        var v = Number(c[1].currentValue)
        var s = zone.speed * (c[1].step || 0.1)
        v += s
        if (v < c[1].min) v = c[1].min
        if (v > c[1].max) v = c[1].max
        var display = v.toFixed(c[1].decimal || 0)
        c[1].currentValue = display
        c[1].selectedLabel = display
        c[1].selectedIdx = 1
        c[1].done = true
        self.setData({ columns: c, displayValue: display })
      }, 120)
    }
  },

  onStart(e) {
    var t = e.touches[0]
    this.setData({ path: [{ x: t.pageX - 12, y: t.pageY, opacity: 1 }], inCancelZone: false, inSubmitZone: false })
    this.stopDial()
    this.dialRect = null
  },

  onMove(e) {
    var t = e.touches[0]
    var ci = this.colX(t.pageX)
    var columns = this.data.columns.slice()

    var inCancel = ci === -2, inSubmit = ci === 99
    var allDone = true; for (var j = 0; j < columns.length; j++) { if (columns[j].selectedIdx < 0) allDone = false }

    // Sync metric → update dial range
    if (columns[0].selectedIdx >= 0) {
      var metricKey = COL_CFG[0].options[columns[0].selectedIdx].value
      if (this._lastMetricKey !== metricKey) {
        this._lastMetricKey = metricKey
        var cfg = COL_CFG[1]
        var range = (cfg.rangesByMetric && cfg.rangesByMetric[metricKey]) || { min: cfg.min, max: cfg.max, unit: cfg.unit, step: cfg.step, decimal: cfg.decimal }
        columns[1].min = range.min; columns[1].max = range.max; columns[1].unit = range.unit
        columns[1].step = range.step; columns[1].decimal = range.decimal
        columns[1].currentValue = ((range.min + range.max) / 2).toFixed(range.decimal)
        columns[1].selectedLabel = String(columns[1].currentValue)
      }
    }

    // Activate/deactivate columns
    for (var k = 0; k < columns.length; k++) {
      if (k === ci) {
        columns[k].active = true
        if (columns[k].revisiting) columns[k].done = false
      } else if (k < ci && ci <= 2) {
        columns[k].active = false; columns[k].revisiting = false; columns[k].done = true
      } else {
        columns[k].active = false; columns[k].revisiting = false
        if (k > ci) { columns[k].done = false; columns[k].selectedIdx = -1; columns[k].selectedLabel = '' }
      }
    }

    // Handle picker columns (0, 2)
    if (ci === 0 || ci === 2) {
      this.stopDial()
      var col = columns[ci]
      if (col.options) {
        var idx = Math.floor((t.pageY - (this.canvasRect ? this.canvasRect.top : 0) - 40) / OPT_H)
        if (idx < 0) idx = 0; if (idx >= col.options.length) idx = col.options.length - 1
        if (col.highlightIdx !== idx) {
          col.highlightIdx = idx; col.selectedIdx = idx; col.selectedLabel = col.options[idx].label; col.done = true
        }
      }
    }

    // Handle dial column (1)
    if (ci === 1) {
      columns[1].done = true
      this.onDialMove(t.pageY)
    } else {
      this.stopDial()
    }

    // Path trace
    var path = this.data.path.slice()
    if (path.length > 50) path.shift()
    path.push({ x: t.pageX - 12, y: t.pageY, opacity: 1 })
    for (var p = 0; p < path.length - 1; p++) { path[p].opacity = (p + 1) / path.length }

    this.setData({ columns: columns, activeColumn: ci,
      inCancelZone: inCancel, inSubmitZone: inSubmit && allDone, path: path })
  },

  onEnd() {
    this.stopDial()
    var inCancel = this.data.inCancelZone, inSubmit = this.data.inSubmitZone
    var columns = this.data.columns.slice()
    for (var i = 0; i < columns.length; i++) { columns[i].active = false; columns[i].highlightIdx = -1 }

    if (inCancel) {
      wx.vibrateShort({ type: 'heavy' })
      this.setData({ columns: buildColumns(), cancelled: true, inCancelZone: false })
      return
    }

    var allDone = true; for (var j = 0; j < columns.length; j++) { if (columns[j].selectedIdx < 0) allDone = false }
    if (inSubmit && allDone) {
      wx.vibrateShort({ type: 'heavy' })
      this.setData({ columns: columns, done: true, inSubmitZone: false })
    } else {
      wx.vibrateShort({ type: 'light' })
      this.setData({ columns: columns })
    }
  },

  onReset() {
    this.stopDial()
    this.setData({ columns: buildColumns(), done: false, cancelled: false,
      activeColumn: -1, inCancelZone: false, inSubmitZone: false, path: [], displayValue: '' })
  },
})
