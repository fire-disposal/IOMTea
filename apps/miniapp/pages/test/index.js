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
      { v: 'resting', l: '静息' }, { v: 'exercise', l: '运动后' }, { v: 'random', l: '随机' }
    ]}
  ]}
]

var SPEED = [
  { name:'fastUp',   f:0.00,t:0.20,s:+4,  c:'#2E7D32' },
  { name:'slowUp',   f:0.20,t:0.40,s:+0.5,c:'#66BB6A' },
  { name:'center',   f:0.40,t:0.60,s:0,   c:'#E0E0E0' },
  { name:'slowDown', f:0.60,t:0.80,s:-0.5,c:'#EF9A9A' },
  { name:'fastDown', f:0.80,t:1.00,s:-4,  c:'#C62828' },
]

function makeFields(fdef) {
  return fdef.map(function (f) {
    return { id: f.id, label: f.label, type: f.type, options: f.options, def: f.def, min: f.min, max: f.max,
      unit: f.unit, step: f.step, dec: f.dec, ranges: f.ranges, selIdx: -1, selLabel: '', hlIdx: -1, done: false }
  })
}

/** Build chain data — only data columns (not metric selector) */
function buildChain(fields, activeCol, odd) {
  // Filter to data columns only (exclude 'metric' id)
  var chainFields = []
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].id !== 'metric') chainFields.push(fields[i])
  }
  var nodes = [], links = []
  for (var j = 0; j < chainFields.length; j++) {
    var locked = chainFields[j].done
    var active = (activeCol >= 0 && fields[activeCol] && fields[activeCol].id === chainFields[j].id)
    nodes.push({ locked: locked, active: active, label: locked ? chainFields[j].selLabel : '' })
    if (j < chainFields.length - 1) {
      links.push({ active: locked })
    }
  }
  if (odd) { nodes.reverse(); links.reverse() }
  return { nodes: nodes, links: links }
}

Page({
  data: {},
  formIdx: 0, canvasRect: null, dialRect: null, dialTimer: null, currentVal: 0,
  dwellTimer: null, dwellActive: false, dwellStart: 0,
  lockedCol: -1,      // column that has been locked (user released in it)
  claimedCol: -1,     // column that currently owns the pointer
  prevClaimed: -1,

  onLoad() {
    var s = this
    wx.createSelectorQuery().select('.test-canvas').boundingClientRect().exec(function (r) { if (r[0]) s.canvasRect = r[0] })
    this._loadForm(0)
  },

  _loadForm(idx, keepPtr) {
    if (idx >= FORMS.length) { this.setData({ allDone: true, pointerVisible: false }); return }
    this._stopDwell(); this._stopDial()
    this.claimedCol = -1; this.prevClaimed = -1
    this.formIdx = idx
    var odd = (idx % 2 === 0)
    var fields = makeFields(FORMS[idx].fields)

    for (var i = 0; i < fields.length; i++) {
      if (fields[i].type === 'dial' && fields[i].def !== undefined) {
        this.currentVal = fields[i].def
        fields[i].selIdx = 1; fields[i].selLabel = String(fields[i].def.toFixed(fields[i].dec || 0))
        // Don't pre-lock dial — user must interact to confirm
      }
    }

    var ch = buildChain(fields, -1, odd)

    this.setData({
      formLabel: FORMS[idx].label, fields: fields, allDone: false,
      leftLabel: odd ? '提交' : '取消', rightLabel: odd ? '取消' : '提交',
      hintText: odd ? '从右向左滑 · 左端停留提交' : '从左向右滑 · 右端停留提交',
      leftZoneActive: false, rightZoneActive: false, activeCol: -1,
      dwellPct: 0, dwellBarVisible: false,
      dialZones: SPEED, dialActiveZone: '', dialLive: false,
      lockFlash: false, pointerVisible: !!keepPtr,
      chain: ch.nodes, chainLinks: ch.links, odd: odd
    })
  },

  _zone(fx) {
    var odd = (this.formIdx % 2 === 0)
    var e = 0.08, fields = this.data.fields || []
    // Count only data columns (exclude metric selector)
    var dataCols = []; for (var i = 0; i < fields.length; i++) { if (fields[i].id !== 'metric') dataCols.push(i) }
    var colCount = dataCols.length
    if (fx < e) return odd ? 'submit' : 'cancel'
    if (fx > 1 - e) return odd ? 'cancel' : 'submit'
    // Map X fraction to data column index
    var colFrac = (fx - e) / (1 - 2 * e)
    var ci = Math.floor(colFrac * colCount)
    if (ci < 0) ci = 0; if (ci >= colCount) ci = colCount - 1
    return dataCols[ci] // return actual field index
  },

  _updateChain(fields, activeCol) {
    var odd = (this.formIdx % 2 === 0)
    var ch = buildChain(fields, activeCol, odd)
    this.setData({ chain: ch.nodes, chainLinks: ch.links })
  },

  _startDwell() {
    this._stopDwell(); this.dwellActive = true; this.dwellStart = Date.now()
    this.setData({ dwellBarVisible: true })
    this._tickDwell()
  },
  _tickDwell() {
    if (!this.dwellActive) return
    var pct = Math.min(100, (Date.now() - this.dwellStart) / 10)
    this.setData({ dwellPct: pct })
    if (pct >= 100) { this._onDwell(); return }
    var s = this; this.dwellTimer = setTimeout(function () { s._tickDwell() }, 30)
  },
  _stopDwell() {
    this.dwellActive = false
    if (this.dwellTimer) { clearTimeout(this.dwellTimer); this.dwellTimer = null }
    this.setData({ dwellPct: 0, dwellBarVisible: false })
  },
  _onDwell() {
    this.dwellActive = false; this.setData({ dwellPct: 0, dwellBarVisible: false })
    this._submitForm()
  },
  _submitForm() {
    this._stopDwell(); this._stopDial()
    wx.vibrateShort({ type: 'heavy' })
    this.setData({ lockFlash: true, leftZoneActive: false, rightZoneActive: false, pointerVisible: true })
    var s = this; setTimeout(function () { s.setData({ lockFlash: false }); s._loadForm(s.formIdx + 1, true) }, 350)
  },
  _cancelForm() {
    this._stopDwell(); this._stopDial()
    this.claimedCol = -1; this.prevClaimed = -1
    wx.vibrateShort({ type: 'heavy' })
    var odd = (this.formIdx % 2 === 0)
    var fields = makeFields(FORMS[this.formIdx].fields)
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].type === 'dial' && fields[i].def !== undefined) {
        fields[i].selIdx = 1; fields[i].selLabel = String(fields[i].def.toFixed(fields[i].dec || 0))
        this.currentVal = fields[i].def
      }
    }
    this.setData({ fields: fields, leftZoneActive: false, rightZoneActive: false, activeCol: -1, displayValue: '' })
    this._updateChain(fields, -1)
    this._updateChain(fields, -1)
  },

  _applyMetric(fields) {
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].type === 'dial' && fields[i].ranges) {
        var mc = null
        for (var j = 0; j < fields.length; j++) { if (fields[j].id === 'metric' && fields[j].selIdx >= 0) { mc = fields[j]; break } }
        if (mc) { var r = fields[i].ranges[mc.options[mc.selIdx].v]; if (r) { fields[i].min = r.min; fields[i].max = r.max; fields[i].unit = r.unit; fields[i].step = r.step; fields[i].dec = r.dec } }
      }
    }
    return fields
  },

  _dialMove(t, f, fs) {
    var s = this; if (!this.dialRect) { wx.createSelectorQuery().select('.test-dial-col').boundingClientRect().exec(function (r2) { if (r2 && r2[0]) s.dialRect = r2[0] }); return }
    var frac = (t.pageY - this.dialRect.top) / this.dialRect.height; if (frac < 0) frac = 0; if (frac > 1) frac = 1
    var zn = null; for (var i = 0; i < SPEED.length; i++) { if (frac >= SPEED[i].f && frac <= SPEED[i].t) { zn = SPEED[i]; break } }
    if (!zn) return
    this.setData({ dialActiveZone: zn.name, dialLive: zn.s !== 0 }); this._stopDial()
    if (zn.s !== 0) { this.dialTimer = setInterval(function () { s._dialTick(zn.s) }, 100) }
  },
  _dialTick(speed) {
    var fs = this.data.fields.slice(); var f = fs[this.data.activeCol]; if (!f) return
    var v = Number(this.currentVal) + speed * (f.step || 0.1); if (v < f.min) v = f.min; if (v > f.max) v = f.max
    this.currentVal = v; var disp = v.toFixed(f.dec || 0); f.selIdx = 1; f.selLabel = disp
    this.setData({ fields: fs, displayValue: disp })
  },
  _stopDial() { if (this.dialTimer) { clearInterval(this.dialTimer); this.dialTimer = null } },

  // ── Touch ──
  onStart(e) {
    var t = e.touches[0]
    this.setData({ pointerVisible: true, pointerX: t.pageX - 20, pointerY: t.pageY - 20, trail: [{ x: t.pageX - 4, y: t.pageY - 4, o: 1, w: 12 }] })
  },
  onMove(e) {
    var t = e.touches[0], r = this.canvasRect; if (!r) return
    var z = this._zone((t.pageX - r.left) / r.width), odd = (this.formIdx % 2 === 0)
    var fs = this.data.fields.slice(); if (!fs) return

    if (z === 'cancel') { this._stopDwell(); this._stopDial(); this.setData({ leftZoneActive: odd, rightZoneActive: !odd }) }
    else if (z === 'submit') {
      this._stopDial()
      var allSel = fs.every(function (f) { return f.selIdx >= 0 })
      if (allSel) { this.setData({ leftZoneActive: !odd, rightZoneActive: odd }); if (!this.dwellActive) this._startDwell() }
    } else if (typeof z === 'number') {
      // Column claim system: only one column active at a time
      this._stopDwell(); this.setData({ leftZoneActive: false, rightZoneActive: false })

      // If entering a new column, clear previous highlight
      if (this.claimedCol !== z) {
        if (this.prevClaimed >= 0 && this.prevClaimed < fs.length) {
          fs[this.prevClaimed].hlIdx = -1
        }
        this.prevClaimed = this.claimedCol
        this.claimedCol = z
      }

      this.setData({ activeCol: z })
      var f = fs[z]; if (!f) return
      if (f.type === 'picker') {
        var idx = Math.floor((t.pageY - 120) / 80)
        if (idx < 0) idx = 0; if (idx >= f.options.length) idx = f.options.length - 1
        if (f.hlIdx !== idx) { f.hlIdx = idx; this.setData({ fields: fs }) }
      }
      if (f.type === 'dial') this._dialMove(t, f, fs)
    }

    var tr = this.data.trail.slice(); if (tr.length > 50) tr.shift()
    tr.push({ x: t.pageX - 4, y: t.pageY - 4, o: 1, w: 10 })
    for (var i = 0; i < tr.length - 1; i++) { tr[i].o = (i + 1) / tr.length; tr[i].w = 4 + 6 * (i / tr.length) }
    this.setData({ pointerX: t.pageX - 20, pointerY: t.pageY - 20, trail: tr })
  },
  onEnd(e) {
    var t = e.changedTouches[0], r = this.canvasRect; if (!r) return
    var z = this._zone((t.pageX - r.left) / r.width), fs = this.data.fields.slice(); if (!fs) return
    this._stopDwell(); this._stopDial()

    if (z === 'cancel') { this._cancelForm(); return }
    if (z === 'submit' && fs.every(function (f) { return f.selIdx >= 0 })) { this._submitForm(); return }

    if (typeof z === 'number') {
      var f = fs[z]
      if (f.type === 'picker' && f.hlIdx >= 0) {
        f.selIdx = f.hlIdx; f.selLabel = f.options[f.hlIdx].l; f.hlIdx = -1; f.done = true
        wx.vibrateShort({ type: 'light' }); fs = this._applyMetric(fs)
      }
      if (f.type === 'dial') { f.done = true; f.selIdx = 1; f.selLabel = String(this.currentVal.toFixed(f.dec || 0)) }
    }

    this.setData({ fields: fs, leftZoneActive: false, rightZoneActive: false, activeCol: -1, dialLive: false, dialActiveZone: '' })
    this.claimedCol = -1; this.prevClaimed = -1
    this._updateChain(fs, -1)
  },
  reset() { this._stopDial(); this._stopDwell(); this.setData({ pointerVisible: false, trail: [] }); this._loadForm(0) },
})
