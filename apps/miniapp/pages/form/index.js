const { api } = require('../../utils/api')
const { STORAGE_KEYS } = require('../../constants/storage-keys')

Page({
  data: {
    form: null,
    code: '',
    responses: {},
    checkboxState: {},
    submitting: false,
    loading: true,
  },

  onLoad(options) {
    var code = options.code || ''
    if (!code) return
    this.setData({ code: code })
    api.get('/forms/' + code)
      .then(function (form) {
        // Init responses for multi-select fields
        var responses = {}
        if (form && form.fields) {
          for (var i = 0; i < form.fields.length; i++) {
            var f = form.fields[i]
            if (f.type === 'multi') responses[f.id] = []
          }
        }
        this.setData({ form: form, responses: responses, loading: false })
        this.updateCheckboxState()
      }.bind(this))
      .catch(function () {
        this.setData({ loading: false })
      }.bind(this))
  },

  updateCheckboxState() {
    var state = {}
    var responses = this.data.responses
    for (var key in responses) {
      if (Array.isArray(responses[key])) {
        for (var i = 0; i < responses[key].length; i++) {
          state[key + '_' + responses[key][i]] = true
        }
      }
    }
    this.setData({ checkboxState: state })
  },

  onRadioChange(e) {
    var fieldId = e.currentTarget.dataset.fieldId
    var responses = this.data.responses
    responses[fieldId] = e.detail.value
    this.setData({ responses: Object.assign({}, responses) })
  },

  onCheckboxChange(e) {
    var fieldId = e.currentTarget.dataset.fieldId
    var responses = this.data.responses
    responses[fieldId] = e.detail.value
    this.setData({ responses: Object.assign({}, responses) })
    this.updateCheckboxState()
  },

  onSliderChange(e) {
    var fieldId = e.currentTarget.dataset.fieldId
    var responses = this.data.responses
    responses[fieldId] = e.detail.value
    this.setData({ responses: Object.assign({}, responses) })
  },

  onInputChange(e) {
    var fieldId = e.currentTarget.dataset.fieldId
    var responses = this.data.responses
    responses[fieldId] = e.detail.value
    this.setData({ responses: Object.assign({}, responses) })
  },

  onNumberInput(e) {
    var fieldId = e.currentTarget.dataset.fieldId
    var responses = this.data.responses
    responses[fieldId] = Number(e.detail.value)
    this.setData({ responses: Object.assign({}, responses) })
  },

  onTextareaInput(e) {
    var fieldId = e.currentTarget.dataset.fieldId
    var responses = this.data.responses
    responses[fieldId] = e.detail.value
    this.setData({ responses: Object.assign({}, responses) })
  },

  submit() {
    var patientId = wx.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
    if (!patientId) {
      wx.showToast({ title: '未绑定患者', icon: 'none' })
      return
    }
    var form = this.data.form
    if (form && form.fields) {
      for (var i = 0; i < form.fields.length; i++) {
        var f = form.fields[i]
        if (f.required && this.data.responses[f.id] === undefined) {
          wx.showToast({ title: '请填写: ' + f.label, icon: 'none' })
          return
        }
      }
    }
    this.setData({ submitting: true })
    var code = this.data.code
    api.post('/forms/' + code + '/respond', {
      patientId: patientId,
      responses: this.data.responses,
    })
      .then(function () {
        wx.showToast({ title: '提交成功', icon: 'success' })
        this.setData({ submitting: false })
        setTimeout(function () { wx.navigateBack() }, 1000)
      }.bind(this))
      .catch(function () {
        wx.showToast({ title: '提交失败', icon: 'none' })
        this.setData({ submitting: false })
      }.bind(this))
  },
})
