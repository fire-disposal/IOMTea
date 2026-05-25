// @ts-nocheck
import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { trpc } from '../../utils/trpc'

const typeNames: Record<string, string> = {
  mattress: '床垫',
  vision: '视觉',
  imu: 'IMU',
  generic: '通用',
  simulator: '仿真',
  custom: '自定�?,
}
const statusColor: Record<string, string> = {
  active: '#2f9e44',
  inactive: '#adb5bd',
  maintenance: '#f08c00',
}

export default function Devices() {
  const [devices, setDevices] = useState<any[]>([])

  useEffect(() => {
    trpc.device.list.query({ pageSize: 100 }).then((r: any) => setDevices(r || []))
  }, [])

  return (
    <View className="page">
      {devices.length === 0 && <Text className="empty">无设�?/Text>}
      {devices.map((d) => (
        <View key={d.id} className="device-item">
          <Text className="device-serial">{d.serialNumber}</Text>
          <View className="device-meta">
            <Text className="device-type">{typeNames[d.deviceType] || d.deviceType}</Text>
            <Text className="device-status" style={{ color: statusColor[d.status] }}>
              {d.status}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}
