import { useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getLocalRecords } from '../../utils/storage'
import './index.scss'

const MODULES = [
  { value: 'blood_glucose', label: '血糖' },
  { value: 'blood_pressure', label: '血压' },
  { value: 'weight', label: '体重' },
  { value: 'heart_rate', label: '心率' },
  { value: 'temperature', label: '体温' },
  { value: 'spo2', label: '血氧' },
  { value: 'medication', label: '用药' },
  { value: 'period', label: '生理期' },
]

export default function ExportPage() {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['blood_glucose', 'blood_pressure', 'weight'])

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const handleExport = useCallback(() => {
    const allRecords = getLocalRecords()
    const filtered = allRecords.filter(r => selectedTypes.includes(r.type))

    if (filtered.length === 0) {
      Taro.showToast({ title: '没有可导出的数据', icon: 'none' })
      return
    }

    const header = 'id,type,date,' + Object.keys(filtered[0].data).join(',')
    const rows = filtered.map(r => {
      const base = [r.id, r.type, r.recordedAt]
      const vals = Object.values(r.data)
      return base.concat(vals.map(v => `"${v}"`)).join(',')
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
    <View className='export-page'>
      <Text className='export-title'>导出健康数据</Text>
      <Text className='export-subtitle'>选择要导出的模块</Text>
      <View className='export-modules'>
        {MODULES.map(m => (
          <View
            key={m.value}
            className={`export-chip ${selectedTypes.includes(m.value) ? 'export-chip--active' : ''}`}
            onClick={() => toggleType(m.value)}
          >
            <Text>{m.label}</Text>
          </View>
        ))}
      </View>
      <View className='export-footer'>
        <View className='export-btn' onClick={handleExport}>
          <Text>导出 CSV ({selectedTypes.length} 个模块)</Text>
        </View>
      </View>
    </View>
  )
}
