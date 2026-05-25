import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { STORAGE_KEYS } from '../../constants/storage-keys'
import './index.scss'

export default function PinOverview() {
  const [pins, setPins] = useState<any[]>([])

  const loadPins = () => {
    api.get<any[]>('/pins').then(setPins).catch(() => {})
  }

  useEffect(() => { loadPins() }, [])

  const createPin = async () => {
    await api.post('/pins', { userId: Taro.getStorageSync(STORAGE_KEYS.USER_ID) || '', type: 'device', label: '小程序PIN' } as any)
    loadPins()
  }

  return (
    <View className="pin-page">
      <View className="page-title">PIN 管理</View>
      <View onClick={createPin} className="pin-create-btn"><Text>+ 创建 PIN</Text></View>
      {pins.map((p: any) => (
        <View key={p.pin} className="pin-item">
          <Text>{p.pin} {p.type} {p.label || ''}</Text>
        </View>
      ))}
    </View>
  )
}
