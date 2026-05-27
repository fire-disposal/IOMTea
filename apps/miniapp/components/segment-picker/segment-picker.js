Component({
  properties: {
    options: { type: Array, value: [] },
    value: { type: String, value: '' }
  },

  methods: {
    handleSelect: function (e) {
      var val = e.currentTarget.dataset.value
      this.triggerEvent('change', { value: val })
    }
  }
})
