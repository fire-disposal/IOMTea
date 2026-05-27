Component({
  properties: {
    size: { type: Number, value: 20 }
  },

  data: {
    iconStyle: ''
  },

  observers: {
    'size': function (size) {
      this.setData({
        iconStyle: 'font-size: ' + size + 'px; line-height: ' + size + 'px; display: inline-block;'
      })
    }
  },

  lifetimes: {
    attached: function () {
      var s = this.data.size
      this.setData({
        iconStyle: 'font-size: ' + s + 'px; line-height: ' + s + 'px; display: inline-block;'
      })
    }
  }
})
