Component({
  properties: {
    value: { type: String, value: '' },
    placeholder: { type: String, value: '0' },
    decimal: { type: Boolean, value: false }
  },

  data: {
    showHint: false
  },

  hintTimer: null,

  observers: {
    'value': function (val) {
      var self = this
      if (this.hintTimer) {
        clearTimeout(this.hintTimer)
        this.hintTimer = null
      }
      if (!val) {
        this.hintTimer = setTimeout(function () {
          self.setData({ showHint: true })
        }, 2000)
        this.setData({ showHint: false })
      } else {
        this.setData({ showHint: false })
      }
    }
  },

  lifetimes: {
    detached: function () {
      if (this.hintTimer) {
        clearTimeout(this.hintTimer)
      }
    }
  },

  methods: {
    handleDigit: function (e) {
      var d = e.currentTarget.dataset.digit
      var value = this.data.value || ''

      if (d === '.') {
        if (!this.data.decimal) return
        if (value.indexOf('.') !== -1) return
        this.triggerChange(value + '.')
        return
      }

      if (d === 'back') {
        this.triggerChange(value.slice(0, -1))
        return
      }

      if (value.length >= 6) return

      wx.vibrateShort()
      this.triggerChange(value + d)
    },

    triggerChange: function (newValue) {
      this.triggerEvent('change', { value: newValue })
    }
  }
})
