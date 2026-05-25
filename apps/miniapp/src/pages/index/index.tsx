import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { ChecklistCard } from '../../components/ChecklistCard'
import { TabBar } from '../../components/TabBar'
import { TopBar } from '../../components/TopBar'
import { STORAGE_KEYS } from '../../constants/storage-keys'
import { api } from '../../utils/api'
import './index.scss'

interface PlanItem { id: string; code: string; title: string; fields: Record<string, unknown>[]; rewardCredits: number }

export default function Index() {
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [credit, setCredit] = useState(0)
  const userName = Taro.getStorageSync(STORAGE_KEYS.USER_NAME) || '用户'
  const patientId = Taro.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''

  useEffect(() => {
    if (!Taro.getStorageSync(STORAGE_KEYS.TOKEN)) { Taro.redirectTo({ url: '/pages/login/index' }); return }
    Promise.all([
      api.get<PlanItem[]>('/plans/today', { patientId }),
      api.get<{ credit: number }>('/users/me'),
    ]).then(([today, me]) => { if (today) setPlans(today); if (me) setCredit(me.credit ?? 0) }).catch(() => {})
  }, [])

  return (
    <View className="home-page">
      <TopBar displayName={userName} credit={credit} />
      <View className="home-checklist anim-stagger">
        {plans.map((p) => (
          <ChecklistCard key={p.id} moduleKey={p.code} label={p.title} icon="📋" status="pending" recordPage={`/pages/record/${p.code}/index`} />
        ))}
        {plans.length === 0 && (
          <View className="home-checklist__empty">
            <Text className="home-checklist__empty-icon">📋</Text>
            <Text className="home-checklist__empty-text">暂无计划</Text>
            <Text className="home-checklist__empty-hint" onClick={() => Taro.navigateTo({ url: '/pages/plan/index' })}>去制定健康计划 →</Text>
          </View>
        )}
      </View>
      <TabBar current="index" />
    </View>
  )
}
