import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import './index.scss'

export default function Messages() {
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    api.get<any[]>('/alerts', { pageSize: '30' }).then(setAlerts).catch(() => {})
  }, [])

  return (
    <View className="messages-page">
      {alerts.map((a: any) => (
        <View key={a.id} className="msg-item">
          <Text>{a.metric}: {String(a.value)}</Text>
        </View>
      ))}
    </View>
  )
}
