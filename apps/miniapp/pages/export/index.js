const { HEALTH_MODULE_META } = require('../../constants/modules')
const { getLocalRecords } = require('../../utils/storage')

const MODULES = Object.keys(HEALTH_MODULE_META).map(function (value) {
  return { value: value, label: HEALTH_MODULE_META[value].label }
})

Page({
  data: {
    modules: MODULES,
    selectedTypes: ['blood_glucose', 'blood_pressure', 'weight'],
    selectedMap: { blood_glucose: true, blood_pressure: true, weight: true },
  },

  onTypeToggle(e) {
    var type = e.currentTarget.dataset.type
    var selected = this.data.selectedTypes.slice()
    var idx = selected.indexOf(type)
    if (idx > -1) { selected.splice(idx, 1) } else { selected.push(type) }
    var map = {}
    for (var i = 0; i < selected.length; i++) { map[selected[i]] = true }
    this.setData({ selectedTypes: selected, selectedMap: map })
  },

  handleExport() {
    var allRecords = getLocalRecords()
    var filtere = []
    for (var i = 0; i < allRecords.length; i++) {
      if (this.data.selectedTypes.indexOf(allRecords[i].type) > -1) {
        filtere.push(allRecords[i])
      }
    }

    if (filtere.length === 0) {
      wx.showToast({ title: '没有可导出的数据', icon: 'none' })
      return
    }

    var dataKeys = Object.keys(filtere[0].data)
    var header = 'id,type,date,' + dataKeys.join(',')
    var rows = filtere.map(function (r) {
      var base = [r.id, r.type, r.recordedAt]
      var vals = dataKeys.map(function (k) { return '"' + String(r.data[k]) + '"' })
      return base.concat(vals).join(',')
    })
    var csv = header + '\n' + rows.join('\n')

    var fs = wx.getFileSystemManager()
    var filePath = wx.env.USER_DATA_PATH + '/health-export-' + Date.now() + '.csv'
    fs.writeFileSync(filePath, csv, 'utf-8')

    wx.shareFileMessage({
      filePath: filePath,
      fileName: '健康数据_' + new Date().toISOString().slice(0, 10) + '.csv',
    })
  },
})
