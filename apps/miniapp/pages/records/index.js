const { HEALTH_MODULE_LABELS } = require('../../constants/modules')
const { getLocalRecords } = require('../../utils/storage')

var GLUCOSE_CONTEXT_LABELS = {
  fasting: '空腹',
  postprandial: '餐后',
  bedtime: '睡前',
  random: '随机',
}

var HR_CONTEXT_LABELS = {
  resting: '静息',
  after_exercise: '运动后',
  random: '随机',
}

var FLOW_LABELS = {
  light: '轻',
  medium: '中',
  heavy: '重',
}

function formatRecordContent(r) {
  switch (r.type) {
    case 'blood_glucose': {
      var ctx = GLUCOSE_CONTEXT_LABELS[r.data.context] || r.data.context || ''
      return '值: ' + r.data.value_mgdl + ' mmol/L · ' + ctx
    }
    case 'blood_pressure': {
      var s = r.data.systolic + '/' + r.data.diastolic + ' mmHg'
      if (r.data.heart_rate != null) s += ' · HR ' + r.data.heart_rate
      return s
    }
    case 'weight': {
      var s = r.data.weight_kg + ' kg'
      if (r.data.body_fat_pct != null) s += ' · 体脂 ' + r.data.body_fat_pct + '%'
      return s
    }
    case 'heart_rate': {
      var ctx = HR_CONTEXT_LABELS[r.data.context] || r.data.context || ''
      return r.data.bpm + ' bpm · ' + ctx
    }
    case 'temperature':
      return r.data.celsius + ' °C'
    case 'spo2':
      return r.data.percentage + '%'
    case 'medication':
      return r.data.drug + ' · ' + (r.data.action === 'taken' ? '已服用' : '已跳过')
    case 'period': {
      var d = r.data
      var parts = []
      if (d.flow) parts.push('流量 ' + (FLOW_LABELS[d.flow] || d.flow))
      if (d.symptoms && d.symptoms.length) parts.push(d.symptoms.join(', '))
      return parts.join(' · ')
    }
    default:
      return ''
  }
}

Page({
  data: {
    records: [],
    loading: true,
    type: '',
    label: '记录',
  },

  onLoad(options) {
    var type = options.type || ''
    var label = HEALTH_MODULE_LABELS[type] || '记录'
    var all = getLocalRecords(type)
    all.sort(function (a, b) {
      return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    })
    var formatted = all.map(function (r) {
      return {
        id: r.id,
        time: new Date(r.recordedAt).toLocaleString('zh-CN'),
        content: formatRecordContent(r),
      }
    })
    this.setData({ records: formatted, loading: false, type: type, label: label })
  },
})
