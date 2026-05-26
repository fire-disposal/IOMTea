// @ts-nocheck
import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { trpc } from '../../utils/trpc'

const typeLabels: Record<string, string> = {
  device: '设备',
  virtual: '虚拟',
  user: '用户',
  simulator: '仿真',
}

export default function Devices() {
  const [pins, setPins] = useState<any[]>([])

  useEffect(() => {
    trpc.device.list.query({ pageSize: 100 }).then((r: any) => setPins(r || []))
  }, [])

  return (
    <View className="page">
      {pins.length === 0 && <Text className="empty">无设备</Text>}
      {pins.map((p) => (
        <View key={p.pin} className="device-item">
          <Text className="device-serial">{p.pin}</Text>
          <View className="device-meta">
            <Text className="device-type">{typeLabels[p.type] || p.type}</Text>
            {p.label && <Text className="device-status">{p.label}</Text>}
          </View>
        </View>
      ))}
    </View>
  )
}
