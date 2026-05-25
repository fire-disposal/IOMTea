// @ts-nocheck
import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { TabBar } from '../../components/TabBar/TabBar'
import { trpc } from '../../utils/trpc'
import './index.scss'

export default function MessagesPage() {
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

  const severityLabel: Record<string, string> = {
    critical: '危�?,
    warning: '警告',
    info: '提示',
  }

  const statusDot: Record<string, string> = {
    active: '�?,
    acknowledged: '�?,
    resolved: '�?,
  }

  const statusLabel: Record<string, string> = {
    active: '活跃',
    acknowledged: '已确�?,
    resolved: '已解�?,
  }

  return (
    <View className="messages-page">
      <Text className="messages-page__title">消息</Text>

      {loading && <Text className="empty">加载�?..</Text>}

      {!loading && alerts.length === 0 && (
        <View className="messages-page__empty">
          <View className="messages-page__empty-icon">
            <Text className="messages-page__empty-icon-text">�?/Text>
          </View>
          <Text className="messages-page__empty-title">暂无告警</Text>
          <Text className="messages-page__empty-hint">健康提醒和通知将显示在这里</Text>
        </View>
      )}

      {alerts.map((a) => (
        <View
          key={a.id}
          className="alert-item"
          style={{ borderLeft: `3px solid ${severityColor[a.severity] || '#999'}` }}
        >
          <View className="alert-item__header">
            <Text className="alert-item__metric">{a.metric}</Text>
            <Text className="alert-item__severity" style={{ color: severityColor[a.severity] }}>
              {severityLabel[a.severity] || a.severity}
            </Text>
          </View>
          <View className="alert-item__footer">
            <Text className="alert-item__time">{new Date(a.recordedAt).toLocaleString()}</Text>
            <Text className="alert-item__status">
              {statusDot[a.status] || '�?} {statusLabel[a.status] || a.status}
            </Text>
          </View>
        </View>
      ))}

      <TabBar current="messages" />
    </View>
  )
}
