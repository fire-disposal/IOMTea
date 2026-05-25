import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { ChecklistCard } from '../../components/ChecklistCard'
import { TabBar } from '../../components/TabBar'
import { TopBar } from '../../components/TopBar'
import { HEALTH_MODULE_META, type HealthModuleKey } from '../../constants/modules'
import { getRecordPage } from '../../constants/modules'
import { STORAGE_KEYS } from '../../constants/storage-keys'
import { api } from '../../utils/api'
import './index.scss'

interface PlanItem {
  id: string
  code: string
  title: string
  fields: Record<string, unknown>[]
  rewardCredits: number
}

export default function Index() {
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [credit, setCredit] = useState(0)

  const userName = Taro.getStorageSync(STORAGE_KEYS.USER_NAME) || '用户'
  const patientId = Taro.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''

  useEffect(() => {
    const token = Taro.getStorageSync(STORAGE_KEYS.TOKEN)
    if (!token) {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [today, me] = await Promise.all([
        api.get<PlanItem[]>('/plans/today', { patientId }),
        api.get<{ credit: number }>('/users/me'),
      ])
      if (today) setPlans(today)
      if (me) setCredit(me.credit ?? 0)
    } catch {
      // offline fallback
    }
  }

  return (
    <View className="home-page">
      <TopBar displayName={userName} credit={credit} />

      <View className="home-checklist anim-stagger">
        {plans.map((item) => (
          <ChecklistCard
            key={item.id}
            moduleKey={item.code}
            label={item.title}
            icon="📋"
            status="pending"
            recordPage={`/pages/record/${item.code}/index`}
          />
        ))}

        {plans.length === 0 && (
          <View className="home-checklist__empty">
            <Text className="home-checklist__empty-icon">📋</Text>
            <Text className="home-checklist__empty-text">暂无计划</Text>
            <Text
              className="home-checklist__empty-hint"
              onClick={() => Taro.navigateTo({ url: '/pages/plan/index' })}
            >
              去制定健康计�?�?            </Text>
          </View>
        )}
      </View>

      <View className="home-actions">
        <View className="home-action-btn" onClick={() => Taro.navigateTo({ url: '/pages/plan/index' })}>
          <Text className="home-action-btn__icon">📋</Text>
          <Text className="home-action-btn__label">管理计划</Text>
        </View>
        <View className="home-action-btn" onClick={() => Taro.navigateTo({ url: '/pages/health/index' })}>
          <Text className="home-action-btn__icon">📊</Text>
          <Text className="home-action-btn__label">历史记录</Text>
        </View>
      </View>

      <TabBar current="index" />
    </View>
  )
}
