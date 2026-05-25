import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import './index.scss'

export default function Devices() {
  const [pins, setPins] = useState<any[]>([])

  useEffect(() => {
    api.get<any[]>('/pins').then(setPins).catch(() => {})
  }, [])

  return (
    <View className="devices-page">
      <View className="page-title">设备/PIN 管理</View>
      {pins.map((p: any) => (
        <View key={p.pin} className="device-item">
          <Text>{p.pin} ({p.type}) {p.label || ''}</Text>
        </View>
      ))}
    </View>
  )
}
