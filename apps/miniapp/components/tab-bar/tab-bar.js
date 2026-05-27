const TABS = [
  { key: 'index', path: '/pages/index/index', label: '首页', icon: '🏠' },
  { key: 'health', path: '/pages/health/index', label: '健康', icon: '📊' },
  { key: 'messages', path: '/pages/messages/index', label: '告警', icon: '⚠️' },
  { key: 'profile', path: '/pages/profile/index', label: '我的', icon: '👤' },
]

Component({
  properties: {
    current: { type: String, value: 'index' }
  },

  data: {
    tabs: TABS
  },

  methods: {
    handleTab(e) {
      const { path, key } = e.currentTarget.dataset
      if (key === this.data.current) return
      wx.switchTab({ url: path })
    }
  }
})
