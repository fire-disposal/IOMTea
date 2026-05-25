// @ts-nocheck
import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { trpc } from '../../utils/trpc'

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    trpc.alert.list
      .query({ pageSize: 50 })
      .then((r: any) => {
        setAlerts(r || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const severityColor: Record<string, string> = {
    critical: '#e03131',
    warning: '#f08c00',
    info: '#1971c2',
  }

  return (
    <View className="page">
      {loading && <Text className="empty">åŠ è½½ä¸?..</Text>}
      {!loading && alerts.length === 0 && <Text className="empty">æ— å‘Šè­¦è®°å½?/Text>}
      {alerts.map((a) => (
        <View
          key={a.id}
          className="alert-item"
          style={{ borderLeftColor: severityColor[a.severity] || '#999' }}
        >
          <Text className="alert-type">{a.metric}</Text>
          <Text className="alert-severity" style={{ color: severityColor[a.severity] }}>
            {a.severity}
          </Text>
          <Text className="alert-time">{new Date(a.recordedAt).toLocaleString()}</Text>
          <Text className="alert-status">
            {a.status === 'active'
              ? 'â—?æ´»è·ƒ'
              : a.status === 'acknowledged'
                ? 'â—?å·²ç¡®è®?
                : 'âœ?å·²è§£å†?}
          </Text>
        </View>
      ))}
    </View>
  )
}
