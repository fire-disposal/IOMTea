import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import './index.scss'

export default function PlanIndex() {
  const [plans, setPlans] = useState<any[]>([])

  useEffect(() => {
    api.get<any[]>('/plans').then(setPlans).catch(() => {})
  }, [])

  return (
    <View className="plan-page">
      <View className="page-title">健康计划</View>
      {plans.map((p: any) => (
        <View key={p.id} className="plan-item">
          <Text>{p.title} ({p.rewardCredits} credits)</Text>
          <Text className="plan-code">{p.code}</Text>
        </View>
      ))}
    </View>
  )
}
