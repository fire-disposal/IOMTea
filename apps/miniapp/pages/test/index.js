var FORMS = [
  { label: '血糖记录', fields: [
    { id: 'metric', label: '指标', type: 'picker', options: [
      { v: 'blood_glucose', l: '血糖' }, { v: 'blood_pressure', l: '血压' },
      { v: 'heart_rate', l: '心率' }, { v: 'weight', l: '体重' },
      { v: 'temperature', l: '体温' }, { v: 'spo2', l: '血氧' }
    ]},
    { id: 'value', label: '数值', type: 'dial', def: 5.5, min: 1.0, max: 30.0, unit: 'mmol/L', step: 0.1, dec: 1,
      ranges: {
        blood_glucose: { min: 1.0, max: 30.0, unit: 'mmol/L', step: 0.1, dec: 1 },
        blood_pressure: { min: 60, max: 250, unit: 'mmHg', step: 1, dec: 0 },
        heart_rate: { min: 30, max: 220, unit: 'bpm', step: 1, dec: 0 },
        weight: { min: 20, max: 300, unit: 'kg', step: 0.5, dec: 1 },
        temperature: { min: 34.0, max: 43.0, unit: '°C', step: 0.1, dec: 1 },
        spo2: { min: 50, max: 100, unit: '%', step: 1, dec: 0 }
      }
    },
    { id: 'context', label: '场景', type: 'picker', options: [
      { v: 'fasting', l: '空腹' }, { v: 'postprandial', l: '餐后' },
      { v: 'bedtime', l: '睡前' }, { v: 'random', l: '随机' }
    ]}
  ]},
  { label: '血压记录', fields: [
    { id: 'metric', label: '指标', type: 'picker', options: [
      { v: 'blood_glucose', l: '血糖' }, { v: 'blood_pressure', l: '血压' },
      { v: 'heart_rate', l: '心率' }, { v: 'weight', l: '体重' },
      { v: 'temperature', l: '体温' }, { v: 'spo2', l: '血氧' }
    ]},
    { id: 'value', label: '数值', type: 'dial', def: 120, min: 60, max: 250, unit: 'mmHg', step: 1, dec: 0,
      ranges: {
        blood_glucose: { min: 1.0, max: 30.0, unit: 'mmol/L', step: 0.1, dec: 1 },
        blood_pressure: { min: 60, max: 250, unit: 'mmHg', step: 1, dec: 0 },
        heart_rate: { min: 30, max: 220, unit: 'bpm', step: 1, dec: 0 },
        weight: { min: 20, max: 300, unit: 'kg', step: 0.5, dec: 1 },
        temperature: { min: 34.0, max: 43.0, unit: '°C', step: 0.1, dec: 1 },
        spo2: { min: 50, max: 100, unit: '%', step: 1, dec: 0 }
      }
    },
    { id: 'context', label: '场景', type: 'picker', options: [
      { v: 'resting', l: '静息' }, { v: 'exercise', l: '运动后' },
      { v: 'random', l: '随机' }
    ]}
  ]}
]

var SPEED_ZONES = [
  { name:'fastUp',   f:0.00,t:0.15,s:+4,  c:'#6BA539' },
  { name:'slowUp',   f:0.15,t:0.38,s:+0.5,c:'#8EC15B' },
  { name:'center',   f:0.38,t:0.62,s:0,   c:'#ddd' },
  { name:'slowDown', f:0.62,t:0.85,s:-0.5,c:'#8EC15B' },
  { name:'fastDown', f:0.85,t:1.00,s:-4,  c:'#6BA539' },
]

function makeFields(fdef) {
  return fdef.map(function (f) {
    var c = { id: f.id, label: f.label, type: f.type, options: f.options, def: f.def, min: f.min, max: f.max, unit: f.unit, step: f.step, dec: f.dec, ranges: f.ranges }
    c.selIdx = -1; c.selLabel = ''; c.hlIdx = -1; c.done = false
    return c
  })
}

Page({
  data: {},
  formIdx: 0, canvasRect: null, dialRect: null, dialTimer: null, currentVal: 0,
  dwellTimer: null, dwellActive: false, dwellStart: 0,

  _startDwell() {
    this._stopDwell()
    this.dwellActive = true
    this.dwellStart = Date.now()
    var odd = (this.formIdx % 2 === 0)
    this.setData(odd ? { rightDwell: true } : { leftDwell: true })
    this._tickDwell()
  },

  _tickDwell() {
    if (!this.dwellActive) return
    var elapsed = Date.now() - this.dwellStart
    var pct = Math.min(100, (elapsed / 1000) * 100)
    this.setData({ dwellPct: pct, dwellBarVisible: true })
    if (elapsed >= 1000) { this._onDwell(); return }
    var s = this
    this.dwellTimer = setTimeout(function () { s._tickDwell() }, 30)
  },

  _stopDwell() {
    this.dwellActive = false
    if (this.dwellTimer) { clearTimeout(this.dwellTimer); this.dwellTimer = null }
    this.setData({ leftDwell: false, rightDwell: false, dwellPct: 0, dwellBarVisible: false })
  },

  _loadForm(idx, keepPtr) {
    if (idx >= FORMS.length) { this.setData({ allDone: true, pointerVisible: false }); return }
    this._stopDwell(); this._stopDial()
    this.formIdx = idx
    var form = FORMS[idx]
    var odd = (idx % 2 === 0) // even = L→R, odd = R→L
    var fields = makeFields(form.fields)

    // Set default value for dial
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].type === 'dial' && fields[i].def !== undefined) {
        this.currentVal = fields[i].def
        fields[i].selIdx = 1; fields[i].selLabel = String(fields[i].def.toFixed(fields[i].dec || 0))
      }
    }

    this.setData({
      formLabel: form.label, fields: fields, allDone: false,
      leftLabel: odd ? '提交' : '取消', rightLabel: odd ? '取消' : '提交',
      leftZoneBg: odd ? 'rgba(107,165,57,0.04)' : 'rgba(211,47,47,0.04)',
      rightZoneBg: odd ? 'rgba(211,47,47,0.04)' : 'rgba(107,165,57,0.04)',
      hintText: odd ? '从右向左滑 · 左端停留提交' : '从左向右滑 · 右端停留提交',
      leftZoneActive: false, rightZoneActive: false, activeCol: -1,
      leftDwell: false, rightDwell: false,
      dialZones: SPEED_ZONES, dialActiveZone: '', dialLive: false,
      displayValue: '', lockFlash: false,
      pointerVisible: !!keepPtr, trail: keepPtr ? this.data.trail : [],
    })
  },

  /** X fraction → zone: 'cancel' | 'submit' | colIdx */
  _zone(fx) {
    var odd = (this.formIdx % 2 === 0)
    var e = 0.08, colCount = this.data.fields ? this.data.fields.length : 3
    if (fx < e) return odd ? 'submit' : 'cancel'
    if (fx > 1 - e) return odd ? 'cancel' : 'submit'
    var colFrac = (fx - e) / (1 - 2 * e)
    var ci = Math.floor(colFrac * colCount)
    if (ci < 0) ci = 0; if (ci >= colCount) ci = colCount - 1
    return ci
  },

  _startDwell() {
    this._stopDwell()
    this.dwellActive = true
    var odd = (this.formIdx % 2 === 0)
    this.setData(odd ? { rightDwell: true } : { leftDwell: true })
    var s = this
    this.dwellTimer = setTimeout(function () { if (s.dwellActive) s._onDwell() }, 1000)
  },
  _stopDwell() {
    this.dwellActive = false
    if (this.dwellTimer) { clearTimeout(this.dwellTimer); this.dwellTimer = null }
    this.setData({ leftDwell: false, rightDwell: false })
  },
  _onDwell() {
    this.dwellActive = false
    this.setData({ leftDwell: false, rightDwell: false })
    this._submitForm()
  },
  _submitForm() {
    this._stopDwell(); this._stopDial()
    wx.vibrateShort({ type: 'heavy' })
    this.setData({ lockFlash: true, leftZoneActive: false, rightZoneActive: false, pointerVisible: true })
    var s = this
    setTimeout(function () { s.setData({ lockFlash: false }); s._loadForm(s.formIdx + 1, true) }, 350)
  },
  _cancelForm() {
    this._stopDwell(); this._stopDial()
    wx.vibrateShort({ type: 'heavy' })
    var fields = makeFields(FORMS[this.formIdx].fields)
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].type === 'dial' && fields[i].def !== undefined) {
        fields[i].selIdx = 1; fields[i].selLabel = String(fields[i].def.toFixed(fields[i].dec || 0))
        this.currentVal = fields[i].def
      }
    }
    this.setData({ fields: fields, leftZoneActive: false, rightZoneActive: false, activeCol: -1 })
  },

  /** Apply metric selection to dial ranges */
  _applyMetric(fields) {
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].type === 'dial' && fields[i].ranges) {
        var metricCol = fields.find(function (f) { return f.id === 'metric' && f.selIdx >= 0 })
        if (metricCol) {
          var mk = metricCol.options[metricCol.selIdx].v
          var r = fields[i].ranges[mk]
          if (r) { fields[i].min = r.min; fields[i].max = r.max; fields[i].unit = r.unit; fields[i].step = r.step; fields[i].dec = r.dec }
        }
      }
    }
    return fields
  },

  // ── Touch ──
  onStart(e) {
    var t = e.touches[0]
    this.setData({
      pointerVisible: true, pointerX: t.pageX - 20, pointerY: t.pageY - 20,
      trail: [{ x: t.pageX - 4, y: t.pageY - 4, o: 1, w: 12 }]
    })
  },

  onMove(e) {
    var t = e.touches[0]; var r = this.canvasRect; if (!r) return
    var fx = (t.pageX - r.left) / r.width; var z = this._zone(fx)
    var fs = this.data.fields.slice(); if (!fs) return
    var odd = (this.formIdx % 2 === 0)

    // Cancel zone
    if (z === 'cancel') {
      this._stopDwell(); this._stopDial()
      this.setData({ leftZoneActive: odd, rightZoneActive: !odd, activeCol: -1, dialActiveZone: '', dialLive: false })
    }
    // Submit zone (dwell)
    else if (z === 'submit') {
      this._stopDial()
      var allSel = fs.every(function (f) { return f.selIdx >= 0 })
      if (allSel) {
        this.setData({ leftZoneActive: !odd, rightZoneActive: odd, activeCol: -1 })
        if (!this.dwellActive) this._startDwell()
      }
    }
    // Center column
    else if (typeof z === 'number') {
      this._stopDwell()
      this.setData({ leftZoneActive: false, rightZoneActive: false, activeCol: z })
      var f = fs[z]; if (!f) return

      if (f.type === 'picker') {
        // Vertical position → option index
        var colTop = 120, optH = 80
        var idx = Math.floor((t.pageY - colTop) / optH)
        if (idx < 0) idx = 0; if (idx >= f.options.length) idx = f.options.length - 1
        if (f.hlIdx !== idx) { f.hlIdx = idx; this.setData({ fields: fs }) }
      }
      if (f.type === 'dial') this._dialMove(t, f, fs)
    }

    // Trail
    var tr = this.data.trail.slice()
    if (tr.length > 50) tr.shift()
    tr.push({ x: t.pageX - 4, y: t.pageY - 4, o: 1, w: 10 })
    for (var i = 0; i < tr.length - 1; i++) { tr[i].o = (i + 1) / tr.length; tr[i].w = 4 + 6 * (i / tr.length) }
    this.setData({ pointerX: t.pageX - 20, pointerY: t.pageY - 20, trail: tr })
  },

  _dialMove(t, f, fs) {
    var s = this
    if (!this.dialRect) { wx.createSelectorQuery().select('.test-dial-col').boundingClientRect().exec(function (r2) { if (r2 && r2[0]) s.dialRect = r2[0] }); return }
    var dy = t.pageY - this.dialRect.top; var frac = dy / this.dialRect.height
    if (frac < 0) frac = 0; if (frac > 1) frac = 1
    var zn = null
    for (var i = 0; i < SPEED_ZONES.length; i++) { if (frac >= SPEED_ZONES[i].f && frac <= SPEED_ZONES[i].t) { zn = SPEED_ZONES[i]; break } }
    if (!zn) return
    this.setData({ dialActiveZone: zn.name, dialLive: zn.s !== 0 })
    this._stopDial()
    if (zn.s !== 0) { this.dialTimer = setInterval(function () { s._dialTick(zn.s) }, 100) }
  },
  _dialTick(speed) {
    var fs = this.data.fields.slice(); var f = fs[this.data.activeCol]; if (!f) return
    var v = Number(this.currentVal) + speed * (f.step || 0.1)
    if (v < f.min) v = f.min; if (v > f.max) v = f.max
    this.currentVal = v
    var disp = v.toFixed(f.dec || 0)
    f.selIdx = 1; f.selLabel = disp
    this.setData({ fields: fs, displayValue: disp })
  },
  _stopDial() { if (this.dialTimer) { clearInterval(this.dialTimer); this.dialTimer = null } },

  onEnd(e) {
    var t = e.changedTouches[0]; var r = this.canvasRect; if (!r) return
    var fx = (t.pageX - r.left) / r.width; var z = this._zone(fx)
    var fs = this.data.fields.slice(); if (!fs) return

    if (z === 'cancel') { this._cancelForm(); return }
    if (z === 'submit') { var allSel = fs.every(function (f) { return f.selIdx >= 0 }); if (allSel) { this._submitForm(); return } }

    this._stopDwell(); this._stopDial()

    // Lock selection in current column
    if (typeof z === 'number') {
      var f = fs[z]
      if (f.type === 'picker' && f.hlIdx >= 0) {
        f.selIdx = f.hlIdx; f.selLabel = f.options[f.hlIdx].l; f.hlIdx = -1; f.done = true
        wx.vibrateShort({ type: 'light' })
        fs = this._applyMetric(fs)
      }
      if (f.type === 'dial') {
        f.done = true; f.selIdx = 1; f.selLabel = String(this.currentVal.toFixed(f.dec || 0))
      }
    }

    this.setData({ fields: fs, leftZoneActive: false, rightZoneActive: false, activeCol: -1, dialLive: false, dialActiveZone: '' })
  },

  reset() { this._stopDial(); this._stopDwell(); this.setData({ pointerVisible: false, trail: [] }); this._loadForm(0) },
})
