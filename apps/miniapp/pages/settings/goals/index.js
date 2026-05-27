Page({
  data: {
    goals: {
      bloodGlucose: { fastingMin: 3.9, fastingMax: 7.0, postprandialMax: 10.0 },
      weight: { targetKg: 65, minKg: 55, maxKg: 75 },
      bloodPressure: { systolicMax: 140, diastolicMax: 90 },
    },
  },

  onLoad() {
    const stored = wx.getStorageSync('health_goals')
    if (stored) this.setData({ goals: stored })
  },

  onGlucoseFastingMinInput(e) {
    this.setData({ 'goals.bloodGlucose.fastingMin': Number(e.detail.value) })
  },
  onGlucoseFastingMaxInput(e) {
    this.setData({ 'goals.bloodGlucose.fastingMax': Number(e.detail.value) })
  },
  onGlucosePostprandialMaxInput(e) {
    this.setData({ 'goals.bloodGlucose.postprandialMax': Number(e.detail.value) })
  },
  onWeightTargetInput(e) {
    this.setData({ 'goals.weight.targetKg': Number(e.detail.value) })
  },
  onWeightMinInput(e) {
    this.setData({ 'goals.weight.minKg': Number(e.detail.value) })
  },
  onWeightMaxInput(e) {
    this.setData({ 'goals.weight.maxKg': Number(e.detail.value) })
  },
  onBpSystolicInput(e) {
    this.setData({ 'goals.bloodPressure.systolicMax': Number(e.detail.value) })
  },
  onBpDiastolicInput(e) {
    this.setData({ 'goals.bloodPressure.diastolicMax': Number(e.detail.value) })
  },

  save() {
    wx.setStorageSync('health_goals', this.data.goals)
    wx.showToast({ title: '已保存', icon: 'success' })
  },
})
