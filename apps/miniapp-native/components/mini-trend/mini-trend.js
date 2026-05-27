Component({
  properties: {
    data: { type: Array, value: [] },
    width: { type: Number, value: 280 },
    height: { type: Number, value: 60 },
    formatValue: { type: String, value: '' },
    unitLabel: { type: String, value: '' },
    normalRange: { type: Object, value: null }
  },

  data: {
    displayValue: '',
    valueColor: 'var(--brand-500, #6BA539)',
    showEmpty: false
  },

  observers: {
    'data': function (data) {
      if (!data || data.length < 2) {
        this.setData({ showEmpty: true })
        return
      }

      this.setData({ showEmpty: false })

      var latest = data[data.length - 1]
      var formatFn = this.data.formatValue
      var displayValue = formatFn ? this.callFormatFn(latest.value) : String(latest.value)

      var valueColor = 'var(--brand-500, #6BA539)'
      var range = this.data.normalRange
      if (range) {
        if (latest.value < range.min) {
          valueColor = 'var(--color-warning, #ED6C02)'
        } else if (latest.value > range.max) {
          valueColor = 'var(--color-error, #D32F2F)'
        }
      }

      this.setData({ displayValue: displayValue, valueColor: valueColor })

      var self = this
      var query = wx.createSelectorQuery().in(this)
      query.select('#mini-trend-canvas')
        .fields({ node: true, size: true })
        .exec(function (res) {
          if (res && res[0] && res[0].node) {
            self.renderTrend(res[0].node, data, self.data.width, self.data.height)
          }
        })
    }
  },

  methods: {
    callFormatFn: function (value) {
      return String(value)
    },

    renderTrend: function (canvas, data, width, height) {
      var dpr = wx.getSystemInfoSync().pixelRatio || 2
      canvas.width = width * dpr
      canvas.height = height * dpr
      var ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)

      var values = data.map(function (d) { return d.value })
      var min = Math.min.apply(null, values)
      var max = Math.max.apply(null, values)
      var range = max - min || 1
      var stepX = width / (data.length - 1)

      ctx.beginPath()
      ctx.strokeStyle = '#6BA539'
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'

      data.forEach(function (d, i) {
        var x = i * stepX
        var y = height - ((d.value - min) / range) * (height - 10) - 5
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      data.forEach(function (d, i) {
        var x = i * stepX
        var y = height - ((d.value - min) / range) * (height - 10) - 5
        ctx.beginPath()
        ctx.fillStyle = i === data.length - 1 ? '#6BA539' : '#8EC15B'
        ctx.arc(x, y, i === data.length - 1 ? 3 : 2, 0, Math.PI * 2)
        ctx.fill()
      })
    }
  }
})
