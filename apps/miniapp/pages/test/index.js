/** Field definitions — order, direction, type, options */
var FIELD_DEFS = [
  { id: 'metric', label: '指标类型', direction: 'L→R', type: 'picker', options: [
    { value: 'blood_glucose', label: '血糖' }, { value: 'blood_pressure', label: '血压' },
    { value: 'heart_rate', label: '心率' }, { value: 'weight', label: '体重' },
    { value: 'temperature', label: '体温' }, { value: 'spo2', label: '血氧' }
  ]},
  { id: 'value', label: '数值', direction: 'R→L', type: 'dial', defaultValue: 5.5, min: 1.0, max: 30.0, unit: 'mmol/L', step: 0.1, decimal: 1,
    metricRanges: {
      blood_glucose:  { min: 1.0, max: 30.0, unit: 'mmol/L', step: 0.1, dec: 1 },
      blood_pressure: { min: 60,  max: 250,  unit: 'mmHg',  step: 1,   dec: 0 },
      heart_rate:     { min: 30,  max: 220,  unit: 'bpm',   step: 1,   dec: 0 },
      weight:         { min: 20,  max: 300,  unit: 'kg',    step: 0.5, dec: 1 },
      temperature:    { min: 34.0,max: 43.0, unit: '°C',    step: 0.1, dec: 1 },
      spo2:           { min: 50,  max: 100,  unit: '%',     step: 1,   dec: 0 }
    }
  },
  { id: 'context', label: '测量场景', direction: 'L→R', type: 'picker', options: [
    { value: 'fasting', label: '空腹' }, { value: 'postprandial', label: '餐后' },
    { value: 'bedtime', label: '睡前' }, { value: 'random', label: '随机' }
  ]}
]

/** Speed zones for dial (vertical position fraction) */
var SPEED_ZONES = [
  { name: 'fastUp',   from: 0.00, to: 0.12, speed: +4,  color: '#6BA539', desc: '快速+' },
  { name: 'slowUp',   from: 0.12, to: 0.35, speed: +0.5, color: '#8EC15B', desc: '缓速+' },
  { name: 'center',   from: 0.35, to: 0.65, speed: 0,    color: '#ddd',    desc: '保持' },
  { name: 'slowDown', from: 0.65, to: 0.88, speed: -0.5, color: '#8EC15B', desc: '缓速-' },
  { name: 'fastDown', from: 0.88, to: 1.00, speed: -4,   color: '#6BA539', desc: '快速-' },
]

/** Pick option width used for hit-testing */
var OPT_W = 160

function buildFields() {
  return FIELD_DEFS.map(function (f) {
    var f2 = JSON.parse(JSON.stringify(f))
    f2.selectedIdx = -1; f2.selectedLabel = ''; f2.highlightIdx = -1
    return f2
  })
}

Page({
  data: {
    fields: buildFields(), currentField: null, currentIdx: 0, mode: '', hintText: '',
    displayValue: '', dialLive: false, dialActiveZone: '', dialZones: SPEED_ZONES,
    leftLabel: '', rightLabel: '', leftZoneActive: false, rightZoneActive: false,
    leftZoneBg: '', rightZoneBg: '',
    highlightIdx: -1,
    pointerVisible: false, pointerX: 0, pointerY: 0, pointerOpacity: 0,
    trail: [], lockFlash: false, done: false,
  },

  canvasRect: null, dialRect: null, dialTimer: null, currentVal: 0, lastMetric: '',

  onLoad() {
    var self = this
    wx.createSelectorQuery().select('.test-canvas').boundingClientRect()
      .exec(function (r) { if (r[0]) self.canvasRect = r[0] })
    this.loadField(0)
  },

  /** Load a field and configure zones based on its direction */
  loadField(idx) {
    if (idx >= FIELD_DEFS.length) { this.setData({ done: true }); return }
    var f = this.data.fields.slice()
    var cf = f[idx]
    var isL2R = (idx % 2 === 0) // even = L→R, odd = R→L

    this.stopDial()
    this.setData({
      currentField: cf, currentIdx: idx, mode: cf.type,
      hintText: isL2R ? '从左向右滑动选择' : '从右向左滑动选择',
      leftLabel: isL2R ? '取消' : '提交',
      rightLabel: isL2R ? '提交' : '取消',
      leftZoneBg: isL2R ? 'rgba(211,47,47,0.04)' : 'rgba(107,165,57,0.04)',
      rightZoneBg: isL2R ? 'rgba(107,165,57,0.04)' : 'rgba(211,47,47,0.04)',
      highlightIdx: -1, displayValue: cf.type === 'dial' ? String(cf.defaultValue) : '',
      fields: f, lockFlash: false
    })
    this.currentVal = cf.type === 'dial' ? cf.defaultValue : 0
  },

  // ── Touch ──

  onStart(e) {
    var t = e.touches[0]
    this.setData({ pointerVisible: true, pointerX: t.pageX - 20, pointerY: t.pageY - 20, pointerOpacity: 1,
      trail: [{ x: t.pageX - 4, y: t.pageY - 4, o: 1, w: 12 }] })
  },

  onMove(e) {
    var t = e.touches[0]
    var cf = this.data.currentField
    if (!cf) return
    var isL2R = (this.data.currentIdx % 2 === 0)
    var rect = this.canvasRect
    if (!rect) return
    var w = rect.width, l = rect.left
    var fx = (t.pageX - l) / w // 0..1 fraction across canvas

    var edgeW = 0.08 // 8% edge zone width
    var inLeft = fx < edgeW
    var inRight = fx > (1 - edgeW)
    var inCenter = !inLeft && !inRight

    var fields = this.data.fields.slice()
    var f = fields[this.data.currentIdx]

    if (isL2R) {
      // Left = cancel, Right = submit
      if (inRight && f.selectedIdx >= 0) {
        this.setData({ leftZoneActive: false, rightZoneActive: true })
      } else if (inLeft) {
        this.setData({ leftZoneActive: true, rightZoneActive: false })
      } else {
        this.setData({ leftZoneActive: false, rightZoneActive: false })
        if (cf.type === 'picker') this.onPickerMove(t, fx, f, fields)
        if (cf.type === 'dial') this.onDialMove(t, f, fields)
      }
    } else {
      // Right = cancel, Left = submit (reversed)
      if (inLeft && f.selectedIdx >= 0) {
        this.setData({ leftZoneActive: true, rightZoneActive: false })
      } else if (inRight) {
        this.setData({ leftZoneActive: false, rightZoneActive: true })
      } else {
        this.setData({ leftZoneActive: false, rightZoneActive: false })
        if (cf.type === 'picker') this.onPickerMove(t, fx, f, fields)
        if (cf.type === 'dial') this.onDialMove(t, f, fields)
      }
    }

    // Trail
    var trail = this.data.trail.slice()
    if (trail.length > 60) trail.shift()
    trail.push({ x: t.pageX - 4, y: t.pageY - 4, o: 1, w: 10 })
    for (var i = 0; i < trail.length - 1; i++) { trail[i].o = (i + 1) / trail.length; trail[i].w = 4 + 6 * (i / trail.length) }

    this.setData({
      pointerX: t.pageX - 20, pointerY: t.pageY - 20,
      trail: trail, fields: fields
    })
  },

  onPickerMove(t, fx, f, fields) {
    var idx = Math.floor(fx * (f.options ? f.options.length : 1))
    if (idx < 0) idx = 0; if (idx >= f.options.length) idx = f.options.length - 1
    if (f.highlightIdx !== idx) {
      f.highlightIdx = idx
      this.setData({ highlightIdx: idx })
    }
  },

  onDialMove(t, f, fields) {
    var self = this
    if (!this.dialRect) {
      wx.createSelectorQuery().select('.test-dial-wrap').boundingClientRect()
        .exec(function (r) { if (r[0]) self.dialRect = r[0] })
      return
    }
    var h = this.dialRect.height
    var dy = t.pageY - this.dialRect.top
    var frac = dy / h
    if (frac < 0) frac = 0; if (frac > 1) frac = 1

    var zone = null
    for (var i = 0; i < SPEED_ZONES.length; i++) {
      if (frac >= SPEED_ZONES[i].from && frac <= SPEED_ZONES[i].to) { zone = SPEED_ZONES[i]; break }
    }
    if (!zone) return
    this.setData({ dialActiveZone: zone.name, dialLive: zone.speed !== 0 })

    this.stopDial()
    if (zone.speed !== 0) {
      this.dialTimer = setInterval(function () {
        var ff = self.data.fields.slice()
        var fd = ff[self.data.currentIdx]
        var v = Number(self.currentVal) + zone.speed * (fd.step || 0.1)
        if (v < fd.min) v = fd.min
        if (v > fd.max) v = fd.max
        self.currentVal = v
        var disp = v.toFixed(fd.decimal || 0)
        fd.selectedIdx = 1; fd.selectedLabel = disp
        self.setData({ fields: ff, displayValue: disp })
      }, 100)
    }
  },

  onEnd(e) {
    this.stopDial()
    var t = e.changedTouches[0]
    var rect = this.canvasRect
    if (!rect) return
    var fx = (t.pageX - rect.left) / rect.width
    var edgeW = 0.08
    var inLeft = fx < edgeW, inRight = fx > (1 - edgeW)
    var isL2R = (this.data.currentIdx % 2 === 0)
    var fields = this.data.fields.slice()
    var f = fields[this.data.currentIdx]
    var cancel = isL2R ? inLeft : inRight
    var submit = isL2R ? inRight : inLeft

    if (cancel) {
      wx.vibrateShort({ type: 'heavy' })
      this.setData({ fields: buildFields(), done: false, leftZoneActive: false, rightZoneActive: false })
      this.loadField(0)
      return
    }

    if (submit && f.selectedIdx >= 0) {
      // Lock and advance
      wx.vibrateShort({ type: 'medium' })
      f.highlightIdx = -1
      this.setData({ fields: fields, lockFlash: true, leftZoneActive: false, rightZoneActive: false })
      var self = this
      setTimeout(function () {
        self.setData({ lockFlash: false })
        self.loadField(self.data.currentIdx + 1)
      }, 400)
      return
    }

    // Lock current picker selection
    if (f.type === 'picker' && f.highlightIdx >= 0) {
      f.selectedIdx = f.highlightIdx; f.selectedLabel = f.options[f.highlightIdx].label
      f.highlightIdx = -1
      wx.vibrateShort({ type: 'light' })

      // If metric changed, update dial ranges
      if (f.id === 'metric' && f.selectedIdx >= 0) {
        var mk = f.options[f.selectedIdx].value
        var rd = fields[1]
        var r = rd.metricRanges[mk] || {}
        if (r.min !== undefined) { rd.min = r.min; rd.max = r.max; rd.unit = r.unit; rd.step = r.step; rd.decimal = r.dec }
      }
    }

    if (f.type === 'dial') {
      f.selectedIdx = 1; f.selectedLabel = String(this.currentVal.toFixed(f.decimal || 0))
    }

    this.setData({ fields: fields, leftZoneActive: false, rightZoneActive: false, highlightIdx: -1, dialLive: false, dialActiveZone: '' })
  },

  stopDial() { if (this.dialTimer) { clearInterval(this.dialTimer); this.dialTimer = null } },

  reset() {
    this.stopDial()
    this.setData({ fields: buildFields(), done: false, displayValue: '', dialLive: false, dialActiveZone: '', lockFlash: false })
    this.loadField(0)
  },
})
