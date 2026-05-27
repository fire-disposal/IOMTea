Component({
  properties: {
    moduleKey: { type: String, value: '' },
    label: { type: String, value: '' },
    icon: { type: String, value: '' },
    status: { type: String, value: 'pending' },
    recordPage: { type: String, value: '' },
    planId: { type: String, value: '' },
    earnedCredits: { type: Number, value: 0 },
    animDone: { type: Boolean, value: false },
    animCredit: { type: Boolean, value: false }
  },

  methods: {
    handleTap: function () {
      if (this.data.status !== 'pending') return
      var url = this.data.planId
        ? this.data.recordPage + '?planId=' + this.data.planId
        : this.data.recordPage
      wx.navigateTo({ url: url })
    }
  }
})
