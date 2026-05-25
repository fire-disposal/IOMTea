import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import './index.scss'

export default function PlanDetail() {
  const [plans, setPlans] = useState<any[]>([])

  useEffect(() => {
    api.get<any[]>('/plans').then(setPlans).catch(() => {})
  }, [])

  return (
    <View className="plan-detail-page">
      <View className="page-title">计划详情</View>
      {plans.map((p: any) => (
        <View key={p.id} className="plan-detail-item">
          <Text>{p.title} (+{p.rewardCredits})</Text>
          <Text className="plan-cron">{p.cron || '无定时'}</Text>
        </View>
      ))}
    </View>
  )
}
