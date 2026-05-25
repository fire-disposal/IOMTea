import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import './index.scss'

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    api.get<any[]>('/alerts', { pageSize: '50' }).then(setAlerts).catch(() => {})
  }, [])

  return (
    <View className="alerts-page">
      <View className="page-title">告警中心</View>
      {alerts.map((a: any) => (
        <View key={a.id} className="alert-item">
          <Text className="alert-metric">{a.metric}: {String(a.value ?? '-')} {a.unit}</Text>
          <Text className="alert-status">{a.status}</Text>
        </View>
      ))}
    </View>
  )
}
