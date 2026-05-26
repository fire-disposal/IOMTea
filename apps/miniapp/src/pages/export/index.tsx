import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { HEALTH_MODULE_META } from '../../constants/modules'
import { getLocalRecords } from '../../utils/storage'
import './index.scss'

const MODULES = Object.entries(HEALTH_MODULE_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

export default function ExportPage() {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    'blood_glucose',
    'blood_pressure',
    'weight',
  ])

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  const handleExport = useCallback(() => {
    const allRecords = getLocalRecords()
    const filtered = allRecords.filter((r) => selectedTypes.includes(r.type))

    if (filtered.length === 0) {
      Taro.showToast({ title: '没有可导出的数据', icon: 'none' })
      return
    }

    const header = 'id,type,date,' + Object.keys(filtered[0].data).join(',')
    const rows = filtered.map((r) => {
      const base = [r.id, r.type, r.recordedAt]
      const vals = Object.values(r.data)
      return base.concat(vals.map((v) => `"${v}"`)).join(',')
    })
    const csv = [header, ...rows].join('\n')

    const fs = Taro.getFileSystemManager()
    const filePath = `${Taro.env.USER_DATA_PATH}/health-export-${Date.now()}.csv`
    fs.writeFileSync(filePath, csv, 'utf-8')

    Taro.shareFileMessage({
      filePath,
      fileName: `健康数据_${new Date().toISOString().slice(0, 10)}.csv`,
    })
  }, [selectedTypes])

  return (
    <View className="export-page">
      <Text className="export-title">导出健康数据</Text>
      <Text className="export-subtitle">选择要导出的模块</Text>
      <View className="export-modules">
        {MODULES.map((m) => (
          <View
            key={m.value}
            className={`export-chip ${selectedTypes.includes(m.value) ? 'export-chip--active' : ''}`}
            onClick={() => toggleType(m.value)}
          >
            <Text>{m.label}</Text>
          </View>
        ))}
      </View>
      <View className="export-footer">
        <View className="export-btn" onClick={handleExport}>
          <Text>导出 CSV ({selectedTypes.length} 个模块)</Text>
        </View>
      </View>
    </View>
  )
}
