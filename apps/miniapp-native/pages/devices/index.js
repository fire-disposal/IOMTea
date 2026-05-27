const { api } = require('../../utils/api')
const { PIN_TYPE_LABELS } = require('../../constants/modules')

Page({
  data: {
    pins: [],
  },

  onLoad() {
    api.get('/pins')
      .then(function (r) {
        this.setData({ pins: r || [] })
      }.bind(this))
      .catch(function () {})
  },
})
