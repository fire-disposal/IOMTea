Page({
  data: {
    currentStep: 1,
    totalSteps: 3,
    currentValue: '',
    highlighted: '',
    touchActive: false,
    done: false,
    fields: [
      { id: 'metric', label: '指标类型', options: [
        { value: 'blood_glucose', label: '血糖' },
        { value: 'blood_pressure', label: '血压' },
        { value: 'heart_rate', label: '心率' },
        { value: 'weight', label: '体重' },
        { value: 'temperature', label: '体温' },
        { value: 'spo2', label: '血氧' },
      ], value: '' },
      { id: 'value', label: '数值', options: [
        { value: '3.5', label: '3.5' },
        { value: '5.2', label: '5.2' },
        { value: '6.1', label: '6.1' },
        { value: '7.8', label: '7.8' },
        { value: '9.4', label: '9.4' },
        { value: '12.0', label: '12.0' },
      ], value: '' },
      { id: 'context', label: '测量场景', options: [
        { value: 'fasting', label: '空腹' },
        { value: 'postprandial', label: '餐后' },
        { value: 'bedtime', label: '睡前' },
        { value: 'random', label: '随机' },
      ], value: '' },
    ],
    currentOptions: [],
    dragStartX: 0,
    dragStartY: 0,
    optStartY: 0,
    optHeight: 80,
  },

  onLoad() {
    this.loadStep(1)
  },

  loadStep(n) {
    var fields = this.data.fields
    if (n > fields.length) { this.setData({ done: true }); return }
    var field = fields[n - 1]
    this.setData({
      currentStep: n,
      totalSteps: fields.length,
      currentOptions: field.options,
      currentValue: field.value || '',
      highlighted: '',
    })
  },

  getOptionIndex(y) {
    var top = 280
    var h = this.data.optHeight || 80
    var idx = Math.floor((y - top) / h)
    if (idx < 0) idx = 0
    if (idx >= this.data.currentOptions.length) idx = this.data.currentOptions.length - 1
    return idx
  },

  onTouchStart(e) {
    var t = e.touches[0]
    this.setData({ touchActive: true, dragStartX: t.pageX, dragStartY: t.pageY })
  },

  onTouchMove(e) {
    var t = e.touches[0]
    var dx = t.pageX - this.data.dragStartX
    var options = this.data.currentOptions
    if (!options.length) return

    var idx = this.getOptionIndex(t.pageY)
    if (dx > 30) {
      this.setData({ highlighted: options[idx].value })
    } else {
      this.setData({ highlighted: '' })
    }
  },

  onTouchEnd(e) {
    var t = e.changedTouches[0]
    var dx = t.pageX - this.data.dragStartX
    var options = this.data.currentOptions

    if (dx > 30 && this.data.highlighted) {
      var idx = this.getOptionIndex(t.pageY)
      var selected = options[idx]
      var fields = this.data.fields
      var n = this.data.currentStep
      fields[n - 1].value = selected.value

      this.setData({
        fields: fields.slice(),
        currentValue: selected.value,
        highlighted: '',
        touchActive: false,
      })

      wx.vibrateShort({ type: 'medium' })

      var self = this
      setTimeout(function () { self.loadStep(n + 1) }, 400)
    } else {
      this.setData({ highlighted: '', touchActive: false })
    }
  },

  onPrev() {
    var n = this.data.currentStep
    if (n > 1) this.loadStep(n - 1)
  },

  onDone() {
    wx.showToast({ title: '数据已记录', icon: 'success' })
  },

  onReset() {
    var fields = this.data.fields.slice()
    for (var i = 0; i < fields.length; i++) fields[i].value = ''
    this.setData({ done: false, fields: fields })
    this.loadStep(1)
  },
})
