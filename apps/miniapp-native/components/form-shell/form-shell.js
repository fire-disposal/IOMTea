Component({
  properties: {
    title: { type: String, value: '' },
    unit: { type: String, value: '' },
    saving: { type: Boolean, value: false },
    saved: { type: Boolean, value: false },
    recentData: { type: Array, value: [] }
  },

  options: {
    multipleSlots: true
  },

  methods: {
    onSave: function () {
      this.triggerEvent('save')
    }
  }
})
