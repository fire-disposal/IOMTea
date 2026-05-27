const { api } = require('../../../utils/api')
const { STORAGE_KEYS } = require('../../../constants/storage-keys')
const { addLocalRecord, getTrendData } = require('../../../utils/storage')
const { syncUnsyncedRecords } = require('../../../utils/sync')

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

Page({
  data: {
    flow: 'medium',
    symptoms: [],
    symptomMap: {},
    notes: '',
    saving: false,
    saved: false,
    trendData: [],
    flowOptions: [
      { value: 'light', label: '轻' },
      { value: 'medium', label: '中' },
      { value: 'heavy', label: '重' },
    ],
    symptomOptions: ['腹痛', '头痛', '乏力', '腰酸', '情绪波动'],
    dateStr: formatDate(new Date()),
    planId: '',
  },

  onLoad(options) {
    this.setData({ trendData: getTrendData('period', 30), planId: options.planId || '' })
  },

  onFlowTap(e) {
    this.setData({ flow: e.currentTarget.dataset.value })
  },

  onSymptomTap(e) {
    const s = e.currentTarget.dataset.value
    const symptoms = this.data.symptoms.slice()
    const idx = symptoms.indexOf(s)
    if (idx > -1) { symptoms.splice(idx, 1) } else { symptoms.push(s) }
    const map = {}
    for (var i = 0; i < symptoms.length; i++) { map[symptoms[i]] = true }
    this.setData({ symptoms, symptomMap: map })
  },

  onNotesInput(e) {
    this.setData({ notes: e.detail.value })
  },

  handleSave() {
    this.setData({ saving: true })
    addLocalRecord({
      type: 'period',
      data: {
        date: this.data.dateStr,
        flow: this.data.flow,
        symptoms: this.data.symptoms,
        notes: this.data.notes || null,
      },
      recordedAt: new Date().toISOString(),
    })
    if (this.data.planId) {
      const patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
      api.post('/plans/' + this.data.planId + '/complete', { patientId }).catch(() => {})
    }
    syncUnsyncedRecords()
    this.setData({ trendData: getTrendData('period', 30) })
    wx.vibrateShort()
    this.setData({ saving: false, saved: true })
    setTimeout(() => wx.navigateBack(), 600)
  },
})
