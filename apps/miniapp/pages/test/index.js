var METRICS = {
  blood_glucose: { label:'血糖',
    fields:[{id:'value',label:'数值',type:'dial',min:1.0,max:30.0,unit:'mmol/L',normal:5.5},{id:'context',label:'场景',type:'picker',options:[{v:'fasting',l:'空腹'},{v:'postprandial',l:'餐后'},{v:'bedtime',l:'睡前'},{v:'random',l:'随机'}]}]},
  blood_pressure: { label:'血压',
    fields:[{id:'sys',label:'收缩压',type:'dial',min:60,max:250,unit:'mmHg',normal:120},{id:'dia',label:'舒张压',type:'dial',min:30,max:150,unit:'mmHg',normal:80},{id:'context',label:'场景',type:'picker',options:[{v:'resting',l:'静息'},{v:'exercise',l:'运动后'},{v:'random',l:'随机'}]}]},
  heart_rate: { label:'心率',
    fields:[{id:'value',label:'数值',type:'dial',min:30,max:220,unit:'bpm',normal:72},{id:'context',label:'场景',type:'picker',options:[{v:'resting',l:'静息'},{v:'exercise',l:'运动后'},{v:'random',l:'随机'}]}]},
  weight: { label:'体重',
    fields:[{id:'value',label:'数值',type:'dial',min:20,max:300,unit:'kg',normal:65}]},
  temperature: { label:'体温',
    fields:[{id:'value',label:'数值',type:'dial',min:34.0,max:43.0,unit:'°C',normal:36.5}]},
  spo2: { label:'血氧',
    fields:[{id:'value',label:'数值',type:'dial',min:70,max:100,unit:'%',normal:98}]},
}

var METRIC_KEYS = Object.keys(METRICS)
var SPEED=[{name:'fastUp',f:0,t:0.2,s:4,c:'#2E7D32'},{name:'slowUp',f:0.2,t:0.4,s:0.5,c:'#66BB6A'},{name:'center',f:0.4,t:0.6,s:0,c:'#E0E0E0'},{name:'slowDown',f:0.6,t:0.8,s:-0.5,c:'#EF9A9A'},{name:'fastDown',f:0.8,t:1,s:-4,c:'#C62828'}]

function initField(f){
  var c={id:f.id,label:f.label,type:f.type,options:f.options,min:f.min,max:f.max,unit:f.unit,normal:f.normal}
  c.selIdx=-1;c.selLabel='';c.hlIdx=-1;c.done=false
  if(c.type==='dial'&&c.min!==undefined){c.selIdx=1;c.done=false}
  return c
}

Page({
  data: { dz: SPEED, trail: [], connectors: [], pv: false, ad: false, colGray: [] },
  fi: 0, cr: null, _pxr: 1, cc: -1, pc: -1, traversed: [],
  dwa: false, dws: 0, dwt: null, dt: null, _dialSpeed: 0,
  subIdx: 0, currentMetric: null, _submitLock: false,

  onLoad() {
    var s = this
    wx.createSelectorQuery()
      .select('.test-canvas')
      .boundingClientRect()
      .exec(function (r) { if (r[0]) s.cr = r[0] })
    this._pxr = wx.getSystemInfoSync().screenWidth / 750
    this._loadForm(0)
  },

  onUnload() {
    this._stopDwell()
    this._stopDial()
    this.dwt = null
    this.dt = null
  },

  _loadForm(subIdx, metricKey) {
    this._stopDwell(); this._stopDial()
    this.cc = -1; this.pc = -1; this.subIdx = subIdx; this.traversed = []; this._submitLock = true

    var mk = metricKey || METRIC_KEYS[0]
    var meta = METRICS[mk]
    if (!meta) { this.setData({ ad: true, pv: false }); return }
    this.currentMetric = mk

    var odd = subIdx % 2 === 0
    var chainFields = meta.fields.map(initField)
    var chips = METRIC_KEYS.map(function (k) { return { v: k, l: METRICS[k].label } })
    var chipSel = METRIC_KEYS.indexOf(mk)

    for (var k = 0; k < chainFields.length; k++) {
      if (chainFields[k].type === 'dial' && chainFields[k].normal !== undefined) {
        chainFields[k].selIdx = 1
        var dec = Number(chainFields[k].min) % 1 !== 0 || Number(chainFields[k].max) % 1 !== 0 ? 1 : 0
        chainFields[k].selLabel = String(chainFields[k].normal.toFixed(dec))
        chainFields[k].value = chainFields[k].normal
      } else if (chainFields[k].type === 'picker' && chainFields[k].options && chainFields[k].options.length > 0) {
        // Default picker selected option
        chainFields[k].selIdx = 0
        chainFields[k].selLabel = chainFields[k].options[0].l
      }
    }
    this._updateColGray()

    this.setData({
      metricChips: chips, metricSelIdx: chipSel,
      chainFields: chainFields, ad: false,
      guide: guide, otherLabel: os,
      ht: odd ? '从左向右通过·右端停留提交' : '从右向左通过·左端停留提交',
      lza: false, rza: false, ac: -1,
      dp: 0, dbv: false,
      daz: '', dlv: false,
      lf: false, stl: 0,
      pv: false, odd: odd, colGray: [],
    })
  },

  _resolveZone(nx) {
    var odd = this.subIdx % 2 === 0
    var e = 0.08
    var cf = this.data.chainFields
    var n = cf ? cf.length : 2

    if (odd) {
      if (nx < e) return 'guide'
      if (nx > 1 - e) return 'submit'
    } else {
      if (nx < e) return 'submit'
      if (nx > 1 - e) return 'guide'
    }

    var raw = Math.floor((nx - e) / (1 - 2 * e) * n)
    if (raw < 0) raw = 0
    if (raw >= n) raw = n - 1
    return odd ? raw : n - 1 - raw
  },

  _pickOption(ci, pageY) {
    var cr = this.cr
    var cf = this.data.chainFields
    if (!cr || !cf || !cf[ci] || cf[ci].type !== 'picker') return -1
    var opts = cf[ci].options
    var n = opts.length
    if (!n) return -1

    var labelH = Math.round(60 * this._pxr)
    var top = cr.top + labelH
    var availH = cr.height - labelH - 20
    if (availH < 24 * n) availH = 24 * n
    var optH = availH / n
    var idx = Math.floor((pageY - top) / optH)
    if (idx < 0) idx = 0
    if (idx >= n) idx = n - 1
    return idx
  },

  _resetLocked(cf) {
  },
  _updateColGray() {
    var g = []
    var cf = this.data.chainFields
    if (cf) for (var i = 0; i < cf.length; i++) g.push(i > 0 && !this.traversed[i - 1])
    this.setData({ colGray: g })
  },
  _canAccess(ci) {
    if (ci <= 0) return true
    return this.traversed[ci - 1] === true
  },

  _lockColumn(ci) {
    var cf = this.data.chainFields
    if (!cf || !cf[ci] || cf[ci].done) return
    var f = cf[ci]
    if (f.type === 'dial') {
      f.done = true
      var dec = Number(f.min) % 1 !== 0 || Number(f.max) % 1 !== 0 ? 1 : 0
      f.selLabel = String(f.value.toFixed(dec))
      this.setData({ chainFields: cf, stl: 1 })
      var s = this
      setTimeout(function () { s.setData({ stl: 2 }) }, 400)
      setTimeout(function () { s.setData({ stl: 3 }) }, 700)
    } else if (f.type === 'picker') {
      f.done = true
      wx.vibrateShort({ type: 'light' })
      this.setData({ chainFields: cf })
    }
    this._updateConnectors()
  },

  _startDial(t, ci) {
    if (!this._canAccess(ci)) return
    var cr = this.cr
    if (!cr) return
    var labelH = Math.round(60 * this._pxr)
    var top = cr.top + labelH
    var h = cr.height - labelH - 20
    if (h <= 0) return

    var frac = (t.pageY - top) / h
    if (frac < 0) frac = 0
    if (frac > 1) frac = 1

    var zone = null
    for (var i = 0; i < SPEED.length; i++) {
      if (frac >= SPEED[i].f && frac <= SPEED[i].t) { zone = SPEED[i]; break }
    }
    if (!zone) return

    this._dialSpeed = zone.s
    this.setData({ daz: zone.name, dlv: zone.s !== 0 })

    if (zone.s !== 0 && !this.dt) {
      var s = this
      this.dt = setInterval(function () { s._adjustDial() }, 100)
    } else if (zone.s === 0 && this.dt) {
      this._stopDial()
    }
  },

  _adjustDial() {
    var speed = this._dialSpeed
    var cf = this.data.chainFields
    var ac = this.data.ac
    if (!cf || ac < 0 || ac >= cf.length || !cf[ac]) return
    var f = cf[ac]
    if (!f || f.type !== 'dial') return

    var range = f.max - f.min
    var inc = range * speed * 0.01
    if (!f.value || isNaN(f.value)) f.value = f.normal || (f.min + f.max) / 2
    var v = Number(f.value) + inc
    if (v < f.min) v = f.min
    if (v > f.max) v = f.max
    f.value = v
    var dec = Number(f.min) % 1 !== 0 || Number(f.max) % 1 !== 0 ? 1 : 0
    var disp = v.toFixed(dec)
    f.selIdx = 1
    f.selLabel = disp
    this.setData({ chainFields: cf })
  },

  _stopDial() {
    if (this.dt) { clearInterval(this.dt); this.dt = null }
  },

  _startDwell() {
    this._stopDwell()
    this.dwa = true
    this.dws = Date.now()
    this.setData({ dbv: true })
    this._tickDwell()
  },

  _tickDwell() {
    if (!this.dwa) return
    var pct = Math.min(100, (Date.now() - this.dws) / 4)
    this.setData({ dp: pct })
    if (pct >= 100) {
      this._onDwellComplete()
      return
    }
    var s = this
    this.dwt = setTimeout(function () { s._tickDwell() }, 30)
  },

  _stopDwell() {
    this.dwa = false
    if (this.dwt) { clearTimeout(this.dwt); this.dwt = null }
    this.setData({ dp: 0, dbv: false })
  },

  _onDwellComplete() {
    this.dwa = false
    this.setData({ dp: 0, dbv: false })
    this._doSubmit()
  },

  _doSubmit() {
    this._stopDwell(); this._stopDial()
    wx.vibrateShort({ type: 'heavy' })
    // Cycle to next metric after submission
    var keys = METRIC_KEYS
    var ci = this.currentMetric ? keys.indexOf(this.currentMetric) : -1
    var nextMetric = keys[(ci + 1) % keys.length]
    this._loadForm(this.subIdx + 1, nextMetric)
  },

  _updateConnectors() {
    var cr = this.cr
    var cf = this.data.chainFields
    if (!cr || !cf) return

    var labelH = Math.round(60 * this._pxr)
    var top = cr.top + labelH
    var availH = cr.height - labelH - 20
    var n = cf.length
    var colAreaW = cr.width * (1 - 0.16)
    var x0 = cr.left + cr.width * 0.08
    var colW = colAreaW / n
    var cons = []

    for (var i = 0; i < n - 1; i++) {
      var a = cf[i]
      var b = cf[i + 1]
      if (a.done && b.done && a.selIdx >= 0 && b.selIdx >= 0) {
        var yA, yB
        if (a.type === 'dial') {
          yA = top + availH / 2
        } else {
          var optsA = a.options || []
          var optHA = Math.max(24, availH / (optsA.length || 1))
          yA = top + (a.selIdx + 0.5) * optHA
        }
        if (b.type === 'dial') {
          yB = top + availH / 2
        } else {
          var optsB = b.options || []
          var optHB = Math.max(24, availH / (optsB.length || 1))
          yB = top + (b.selIdx + 0.5) * optHB
        }
        var cx = x0 + i * colW + colW / 2
        cons.push({ x1: cx, y: (yA + yB) / 2, w: colW })
      }
    }

    this.setData({ connectors: cons })
  },

  onStart(e) {
    this._submitLock = false
    var t = e.touches[0]
    this.setData({ pv: true, px: t.pageX - 20, py: t.pageY - 20, trail: [{ x: t.pageX - 4, y: t.pageY - 4, o: 1, w: 12 }] })
  },

  onMove(e) {
    var t = e.touches[0]
    var cr = this.cr
    if (!cr) return

    var nx = (t.pageX - cr.left) / cr.width
    var z = this._resolveZone(nx)
    var cf = this.data.chainFields
    if (!cf || this._submitLock) return

    var tr = this.data.trail.slice()
    if (tr.length > 50) tr.shift()
    tr.push({ x: t.pageX - 4, y: t.pageY - 4, o: 1, w: 10 })
    for (var i = 0; i < tr.length - 1; i++) {
      tr[i].o = (i + 1) / tr.length
      tr[i].w = 4 + 6 * (i / tr.length)
    }
    this.setData({ px: t.pageX - 20, py: t.pageY - 20, trail: tr })

    if (z === 'guide') {
      this._stopDwell()
      this._stopDial()
      var odd = this.subIdx % 2 === 0
      this.setData({ lza: odd, rza: !odd })
      return
    }

    if (z === 'submit') {
      this._stopDial()
      var odd = this.subIdx % 2 === 0
      this.setData({ lza: !odd, rza: odd })
      var allDone = cf.every(function (f) { return f.selIdx >= 0 })
      if (allDone && !this.dwa) {
        this._startDwell()
      }
      return
    }

    this._stopDwell()
    this.setData({ lza: false, rza: false })

    if (z !== this.cc) {
      this._stopDial()
      if (this.cc >= 0) {
        this._lockColumn(this.cc)
        this.traversed[this.cc] = true
        this._updateColGray()
        if (cf[this.cc] && cf[this.cc].type === 'picker') cf[this.cc].hlIdx = -1
      }
      this.pc = this.cc
      this.cc = z
    }

    this.setData({ ac: z })

    if (!this._canAccess(z)) return

    var f = cf[z]
    if (!f) return

    if (f.type === 'picker') {
      var idx = Math.max(0, this._pickOption(z, t.pageY))
      if (idx >= 0 && f.selIdx !== idx) {
        f.selIdx = idx
        f.selLabel = f.options[idx].l
        this.setData({ chainFields: cf })
      }
    } else if (f.type === 'dial') {
      this._startDial(t, z)
    }
  },

  onEnd(e) {
    var t = e.changedTouches[0]
    var cr = this.cr
    if (!cr) return

    var nx = (t.pageX - cr.left) / cr.width
    var z = this._resolveZone(nx)
    var cf = this.data.chainFields
    if (!cf) return

    this._stopDwell()
    this._stopDial()

    var allDone = cf.every(function (f) { return f.selIdx >= 0 })

    if (z === 'submit' && allDone) {
      if (this.cc >= 0 && this.cc < cf.length && !cf[this.cc].done) {
        this._lockColumn(this.cc)
      }
      this._doSubmit()
      return
    }

    if (typeof z === 'number' && cf[z] && cf[z].selIdx >= 0) {
      this._lockColumn(z)
      this.traversed[z] = true
      this._updateColGray()
      this.cc = -1
      this.pc = -1
      this.setData({ lza: false, rza: false, ac: -1, dlv: false, daz: '' })
      this._updateConnectors()
      return
    }

    for (var i = 0; i < cf.length; i++) {
      if (cf[i].type === 'picker') {
        cf[i].selIdx = -1
        cf[i].selLabel = ''
        cf[i].done = false
        cf[i].hlIdx = -1
      }
    }

    this.traversed = []
    this._updateColGray()
    this.cc = -1
    this.pc = -1
    this.setData({
      chainFields: cf,
      lza: false, rza: false,
      ac: -1, dlv: false, daz: '',
    })
    this._updateConnectors()
  },

  onMetricTap(e) {
    var idx = Number(e.currentTarget.dataset.idx)
    if (isNaN(idx) || idx < 0 || idx >= METRIC_KEYS.length) return
    var mk = METRIC_KEYS[idx]
    if (mk === this.currentMetric) return
    wx.vibrateShort({ type: 'light' })
    this._loadForm(this.subIdx, mk)
  },

  reset() {
    this._stopDial()
    this._stopDwell()
    this.setData({ pv: false, trail: [] })
    this._loadForm(0)
  },
})
