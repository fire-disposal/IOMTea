var COL_CONFIG = [
  { id: 'metric', label: '指标', options: [
    { value: 'blood_glucose', label: '血糖' }, { value: 'blood_pressure', label: '血压' },
    { value: 'heart_rate', label: '心率' }, { value: 'weight', label: '体重' },
    { value: 'temperature', label: '体温' }, { value: 'spo2', label: '血氧' }
  ]},
  { id: 'value', label: '数值', options: [
    { value: '3.5', label: '3.5' }, { value: '5.2', label: '5.2' }, { value: '6.1', label: '6.1' },
    { value: '7.8', label: '7.8' }, { value: '9.4', label: '9.4' }, { value: '12.0', label: '12.0' }
  ]},
  { id: 'context', label: '场景', options: [
    { value: 'fasting', label: '空腹' }, { value: 'postprandial', label: '餐后' },
    { value: 'bedtime', label: '睡前' }, { value: 'random', label: '随机' }
  ]}
]

var COL_W = 210
var CANCEL_W = 80
var SUBMIT_W = 90
var OPT_H = 76
var COL_START_X = 0

function buildColumns() {
  return COL_CONFIG.map(function (c) {
    return {
      id: c.id, label: c.label, options: c.options,
      active: false, done: false, revisiting: false,
      selectedIdx: -1, selectedLabel: '', highlightIdx: -1
    }
  })
}

function getColOptIdx(col, y, startY) {
  var dy = y - startY
  var idx = Math.floor(dy / OPT_H)
  if (idx < 0) return 0
  if (idx >= col.options.length) return col.options.length - 1
  return idx
}

Page({
  data: {
    columns: buildColumns(),
    activeColumn: -1,
    inCancelZone: false,
    inSubmitZone: false,
    path: [],
    done: false,
    cancelled: false,
  },

  prevColIdx: -1,

  onLoad() {
    var self = this
    wx.createSelectorQuery()
      .select('.test-canvas').boundingClientRect()
      .exec(function (res) {
        if (res[0]) { self.canvasRect = res[0]; COL_START_X = res[0].left }
      })
  },

  zoneByX(x) {
    var dx = x - (COL_START_X || 0)
    if (dx < CANCEL_W) return 'cancel'
    var colIdx = Math.floor((dx - CANCEL_W) / COL_W)
    if (colIdx >= COL_CONFIG.length) return 'submit'
    if (colIdx < 0) return 'cancel'
    return colIdx
  },

  onStart(e) {
    var t = e.touches[0]
    this.setData({
      path: [{ x: t.pageX - 24, y: t.pageY, opacity: 1 }],
      inCancelZone: false, inSubmitZone: false, activeColumn: -1
    })
    this.prevColIdx = -1
  },

  onMove(e) {
    var t = e.touches[0]
    var zone = this.zoneByX(t.pageX)
    var columns = this.data.columns.slice()
    var canvasTop = this.canvasRect ? this.canvasRect.top : 0

    // Cancel zone
    var inCancel = zone === 'cancel'
    
    // Submit zone
    var inSubmit = zone === 'submit'
    var allSelected = true
    for (var j = 0; j < columns.length; j++) {
      if (columns[j].selectedIdx < 0) allSelected = false
    }

    // Column zone
    var ci = (typeof zone === 'number') ? zone : -1
    var changed = false

    if (ci >= 0) {
      // Re-visit logic: if moving back to a previously-done column, re-activate it
      for (var k = 0; k < columns.length; k++) {
        var wasDone = columns[k].done
        if (k === ci) {
          columns[k].active = true
          columns[k].revisiting = wasDone
          if (wasDone) columns[k].done = false
        } else if (k < ci) {
          columns[k].active = false
          columns[k].revisiting = false
          if (!wasDone) columns[k].done = true
        } else {
          columns[k].active = false
          columns[k].revisiting = false
          columns[k].done = false
          columns[k].selectedIdx = -1
          columns[k].selectedLabel = ''
          if (wasDone) changed = true
        }
      }

      var idx = getColOptIdx(columns[ci], t.pageY, canvasTop + 40)
      if (columns[ci].highlightIdx !== idx || columns[ci].selectedIdx !== idx) {
        columns[ci].highlightIdx = idx
        columns[ci].selectedIdx = idx
        columns[ci].selectedLabel = columns[ci].options[idx].label
        changed = true
      }
    } else {
      for (var m = 0; m < columns.length; m++) {
        columns[m].active = false
        columns[m].highlightIdx = -1
      }
    }

    // Path trace
    var path = this.data.path.slice()
    if (path.length > 50) path.shift()
    path.push({ x: t.pageX - 24, y: t.pageY, opacity: 1 })
    for (var p = 0; p < path.length - 1; p++) {
      path[p].opacity = (p + 1) / path.length
    }

    this.setData({
      columns: changed ? columns : this.data.columns,
      activeColumn: ci,
      inCancelZone: inCancel,
      inSubmitZone: inSubmit && allSelected,
      path: path
    })
    if (changed) this.setData({ columns: columns })
  },

  onEnd() {
    var inCancel = this.data.inCancelZone
    var inSubmit = this.data.inSubmitZone
    var columns = this.data.columns.slice()

    for (var i = 0; i < columns.length; i++) {
      columns[i].active = false
      columns[i].highlightIdx = -1
    }

    if (inCancel) {
      wx.vibrateShort({ type: 'heavy' })
      this.setData({ columns: buildColumns(), cancelled: true, inCancelZone: false, activeColumn: -1 })
      return
    }

    var allDone = true
    for (var j = 0; j < columns.length; j++) {
      if (columns[j].selectedIdx < 0) allDone = false
    }

    if (inSubmit && allDone) {
      wx.vibrateShort({ type: 'heavy' })
      this.setData({ columns: columns, done: true, inSubmitZone: false, activeColumn: -1 })
    } else {
      wx.vibrateShort({ type: 'light' })
      this.setData({ columns: columns, activeColumn: -1 })
    }
  },

  onReset() {
    this.setData({
      columns: buildColumns(), done: false, cancelled: false,
      activeColumn: -1, inCancelZone: false, inSubmitZone: false, path: []
    })
  },
})
