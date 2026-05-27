const { api } = require('../../utils/api')
const { STORAGE_KEYS } = require('../../constants/storage-keys')
const { HEALTH_MODULE_META } = require('../../constants/modules')
const { addLocalRecord, getTrendData } = require('../../utils/storage')
const { syncUnsyncedRecords } = require('../../utils/sync')

var FORM_CONFIGS = {
  blood_glucose: {
    title: '血糖', unit: 'mmol/L',
    fields: [{ id: 'value', label: '血糖值', type: 'number', placeholder: '0.0', decimal: true }],
    contexts: [
      { value: 'fasting', label: '空腹' },
      { value: 'postprandial', label: '餐后' },
      { value: 'bedtime', label: '睡前' },
      { value: 'random', label: '随机' }
    ],
    mapRecord: function (data) {
      return { type: 'blood_glucose', data: { value_mgdl: Number(data.value), context: data.context, meal_tag: data.mealTag || null } }
    }
  },
  blood_pressure: {
    title: '血压', unit: 'mmHg',
    fields: [
      { id: 'systolic', label: '收缩压', type: 'number', placeholder: '120' },
      { id: 'diastolic', label: '舒张压', type: 'number', placeholder: '80' },
      { id: 'heartRate', label: '心率 (选填)', type: 'number', placeholder: '72', optional: true }
    ],
    mapRecord: function (data) {
      return { type: 'blood_pressure', data: { systolic: Number(data.systolic), diastolic: Number(data.diastolic), heart_rate: data.heartRate ? Number(data.heartRate) : null } }
    }
  },
  weight: {
    title: '体重', unit: 'kg',
    fields: [{ id: 'value', label: '体重', type: 'number', placeholder: '65.0', decimal: true }],
    mapRecord: function (data) {
      return { type: 'weight', data: { weight_kg: Number(data.value) } }
    }
  },
  heart_rate: {
    title: '心率', unit: 'bpm',
    fields: [{ id: 'value', label: '心率', type: 'number', placeholder: '72' }],
    contexts: [
      { value: 'resting', label: '静息' },
      { value: 'exercise', label: '运动后' },
      { value: 'random', label: '随机' }
    ],
    mapRecord: function (data) {
      return { type: 'heart_rate', data: { bpm: Number(data.value), context: data.context } }
    }
  },
  temperature: {
    title: '体温', unit: '°C',
    fields: [{ id: 'value', label: '体温', type: 'number', placeholder: '36.5', decimal: true }],
    mapRecord: function (data) {
      return { type: 'temperature', data: { celsius: Number(data.value) } }
    }
  },
  spo2: {
    title: '血氧', unit: '%',
    fields: [{ id: 'value', label: '血氧饱和度', type: 'number', placeholder: '98' }],
    validate: function (v) { return v > 0 && v <= 100 },
    mapRecord: function (data) {
      return { type: 'spo2', data: { percentage: Number(data.value) } }
    }
  },
  medication: {
    title: '用药', unit: '',
    fields: [],
    mapRecord: function (data) {
      return { type: 'medication', data: data }
    }
  },
  period: {
    title: '生理期', unit: '',
    fields: [{ id: 'notes', label: '备注', type: 'textarea', placeholder: '选填' }],
    segments: [
      { key: 'flow', label: '流量', options: [{ value: 'light', label: '轻' }, { value: 'medium', label: '中' }, { value: 'heavy', label: '重' }] }
    ],
    chips: {
      key: 'symptoms', options: ['腹痛', '头痛', '乏力', '腰酸', '情绪波动']
    },
    mapRecord: function (data) {
      return { type: 'period', data: { flow: data.flow || 'medium', symptoms: data.symptoms || [], notes: data.notes || '' } }
    }
  }
}

Page({
  data: {
    type: '',
    config: null,
    meta: null,
    values: {},
    context: '',
    segments: {},
    chips: {},
    chipMap: {},
    saving: false,
    planId: '',
    trendData: [],
    dateStr: '',
  },

  onLoad(options) {
    var type = options.type || ''
    if (type === 'blood_glucose') type = 'blood_glucose'
    var config = FORM_CONFIGS[type]
    if (!config) { wx.navigateBack(); return }
    var meta = HEALTH_MODULE_META[type] || { label: config.title, unit: config.unit }

    // Init segment defaults
    var segments = {}
    if (config.segments) {
      for (var i = 0; i < config.segments.length; i++) {
        var sg = config.segments[i]
        segments[sg.key] = sg.options[0].value
      }
    }
    if (config.contexts) { segments.context = config.contexts[0].value }

    this.setData({
      type: type, config: config, meta: meta, segments: segments,
      planId: options.planId || '',
      trendData: getTrendData(type, type === 'period' ? 30 : 7),
      dateStr: new Date().toISOString().slice(0, 10)
    })
    wx.setNavigationBarTitle({ title: (meta.label || config.title) + '记录' })
    this.initChart()
  },

  initChart() {
    var self = this
    var trendData = this.data.trendData
    if (!trendData || trendData.length < 2) return

    var query = wx.createSelectorQuery().in(this)
    query.select('#trendCanvas')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res[0] || !res[0].node) return
        var canvas = res[0].node
        var width = res[0].width
        var height = res[0].height
        var dpr = wx.getSystemInfoSync().pixelRatio || 2
        canvas.width = width * dpr
        canvas.height = height * dpr
        
        var echarts = require('../../components/ec-canvas/echarts.min')
        var chart = echarts.init(canvas, null, {
          width: width, height: height, devicePixelRatio: dpr
        })
        
        var option = {
          grid: { top: 12, bottom: 8, left: 0, right: 8 },
          xAxis: { type: 'category', show: false, data: trendData.map(function (d) { return d.date.slice(5) }) },
          yAxis: { type: 'value', show: false, min: function (v) { return v.min - (v.max - v.min) * 0.2 }, max: function (v) { return v.max + (v.max - v.min) * 0.2 } },
          series: [{
            type: 'line', data: trendData.map(function (d) { return d.value }),
            smooth: true, lineStyle: { color: '#6BA539', width: 2 },
            itemStyle: { color: '#6BA539' }, symbol: 'circle', symbolSize: 6,
            areaStyle: { color: 'rgba(107,165,57,0.08)' }
          }]
        }
        chart.setOption(option)
      })
  },

  handleSave() {
    var config = this.data.config
    var values = this.data.values
    var segments = this.data.segments
    var chips = this.data.chips

    // Validate required fields
    if (config.fields) {
      for (var i = 0; i < config.fields.length; i++) {
        var f = config.fields[i]
        if (!f.optional && (!values[f.id] || values[f.id] === '')) {
          wx.showToast({ title: '请填写' + f.label, icon: 'none' })
          return
        }
        if (f.type === 'number' && Number(values[f.id]) <= 0) {
          wx.showToast({ title: f.label + '值不正确', icon: 'none' })
          return
        }
      }
    }
    if (config.validate && config.fields) {
      for (var j = 0; j < config.fields.length; j++) {
        var ff = config.fields[j]
        if (!config.validate(Number(values[ff.id]))) {
          wx.showToast({ title: ff.label + '超出范围', icon: 'none' })
          return
        }
      }
    }

    this.setData({ saving: true })

    var recordData = Object.assign({}, values, segments, chips)
    var record = config.mapRecord(recordData)
    record.recordedAt = new Date().toISOString()
    addLocalRecord(record)

    if (this.data.planId) {
      var patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
      api.post('/plans/' + this.data.planId + '/complete', { patientId: patientId }).catch(function () {})
    }

    syncUnsyncedRecords()
    wx.vibrateShort()

    this.setData({ saving: false, trendData: getTrendData(this.data.type, this.data.type === 'period' ? 30 : 7) })
    this.initChart()
    wx.showToast({ title: '已保存', icon: 'success', duration: 600 })
    setTimeout(function () { wx.navigateBack() }, 600)
  },
})
