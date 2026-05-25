import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { TopBar } from '../../components/TopBar'
import { ChecklistCard } from '../../components/ChecklistCard'
import { TabBar } from '../../components/TabBar'
import { STORAGE_KEYS } from '../../constants/storage-keys'
import { HEALTH_MODULE_META, type HealthModuleKey } from '../../constants/modules'
import { trpc } from '../../utils/trpc'
import { getRecordPage } from '../../constants/modules'
import './index.scss'

interface ChecklistItem {
  id: string
  moduleKey: string
  status: 'pending' | 'done' | 'skipped'
}

export default function Index() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [credit, setCredit] = useState(0)

  const userName = Taro.getStorageSync(STORAGE_KEYS.USER_NAME) || '用户'

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
      const [list, bal] = await Promise.all([
        trpc.checklist.today.query(),
        trpc.credit.balance.query(),
      ])
      if (list) setChecklist(list)
      if (bal) setCredit(bal.balance)
    } catch {
      // offline fallback
    }
  }

  return (
    <View className="home-page">
      <TopBar displayName={userName} credit={credit} />

      <View className="home-checklist anim-stagger">
        {checklist.map((item) => {
          const meta = HEALTH_MODULE_META[item.moduleKey as HealthModuleKey]
          return (
            <ChecklistCard
              key={item.id}
              moduleKey={item.moduleKey}
              label={meta?.label ?? item.moduleKey}
              icon={meta?.icon ?? '📋'}
              status={item.status}
              recordPage={getRecordPage(item.moduleKey)}
            />
          )
        })}

        {checklist.length === 0 && (
          <View className="home-checklist__empty">
            <Text className="home-checklist__empty-icon">📋</Text>
            <Text className="home-checklist__empty-text">暂无计划</Text>
            <Text
              className="home-checklist__empty-hint"
              onClick={() => Taro.navigateTo({ url: '/pages/plan/index' })}
            >
              去制定健康计划 →
            </Text>
          </View>
        )}
      </View>

      <View className="home-actions">
        <View
          className="home-action-btn"
          onClick={() => Taro.navigateTo({ url: '/pages/plan/index' })}
        >
          <Text className="home-action-btn__icon">📋</Text>
          <Text className="home-action-btn__label">管理计划</Text>
        </View>
        <View
          className="home-action-btn"
          onClick={() => Taro.navigateTo({ url: '/pages/health/index' })}
        >
          <Text className="home-action-btn__icon">📊</Text>
          <Text className="home-action-btn__label">历史记录</Text>
        </View>
      </View>

      <TabBar current="index" />
    </View>
  )
}
