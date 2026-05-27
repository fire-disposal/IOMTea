Component({
  properties: {
    loading: { type: Boolean, value: false },
    saved: { type: Boolean, value: false },
    label: { type: String, value: '保存' }
  },

  methods: {
    handleTap: function () {
      if (this.data.loading || this.data.saved) return
      this.triggerEvent('tap')
    }
  }
})
