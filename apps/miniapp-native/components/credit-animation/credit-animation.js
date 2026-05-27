Component({
  properties: {
    visible: { type: Boolean, value: false },
    amount: { type: Number, value: 0 },
    x: { type: Number, value: 0 },
    y: { type: Number, value: 0 }
  },

  data: {
    posStyle: ''
  },

  observers: {
    'x, y': function (x, y) {
      this.setData({
        posStyle: 'left: ' + x + 'px; top: ' + y + 'px;'
      })
    }
  }
})
