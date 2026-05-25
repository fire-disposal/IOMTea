// @ts-nocheck
import { Button } from '@nutui/nutui-react'
import { Checkbox, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { HEALTH_MODULE_KEYS, HEALTH_MODULE_META } from '../../constants/modules'
import { trpc } from '../../utils/trpc'
import './index.scss'

interface PlanItemState {
  moduleKey: string
  enabled: boolean
  reminderEnabled: boolean
}

export default function PlanPage() {
  const [items, setItems] = useState<Record<string, PlanItemState>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    trpc.plan.get
      .query()
      .then((plan: any) => {
        if (plan?.items) {
          const map: Record<string, PlanItemState> = {}
          for (const item of plan.items) {
            map[item.moduleKey] = {
              moduleKey: item.moduleKey,
              enabled: item.enabled,
              reminderEnabled: item.reminderEnabled,
            }
          }
          for (const key of HEALTH_MODULE_KEYS) {
            if (!map[key]) {
              map[key] = { moduleKey: key, enabled: false, reminderEnabled: false }
            }
          }
          setItems(map)
        } else {
          const map: Record<string, PlanItemState> = {}
          for (const key of HEALTH_MODULE_KEYS) {
            map[key] = { moduleKey: key, enabled: false, reminderEnabled: false }
          }
          setItems(map)
        }
      })
      .catch(() => {})
  }, [])

  const toggle = (key: string) => {
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const input = HEALTH_MODULE_KEYS.filter((k) => items[k]?.enabled).map((k, i) => ({
        moduleKey: k,
        enabled: true,
        reminderEnabled: items[k].reminderEnabled,
        reminderTimes: [],
        frequency: 'daily' as const,
        sortOrder: i,
      }))

      await trpc.plan.upsert.mutate({ items: input })
      Taro.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 800)
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="plan-page">
      <View className="plan-page__header">
        <Text className="plan-page__back" onClick={() => Taro.navigateBack()}>
          ← 返回
        </Text>
        <Text className="plan-page__title">我的健康计划</Text>
        <View style={{ width: 48 }} />
      </View>

      <View className="plan-page__list anim-stagger">
        {HEALTH_MODULE_KEYS.map((key) => {
          const meta = HEALTH_MODULE_META[key]
          const item = items[key]
          return (
            <View key={key} className="plan-item">
              <View className="plan-item__main" onClick={() => toggle(key)}>
                <Checkbox value={key} checked={item?.enabled ?? false} />
                <Text className="plan-item__icon">{meta.icon}</Text>
                <Text className="plan-item__label">{meta.label}</Text>
              </View>
              {item?.enabled && (
                <View
                  className="plan-item__gear"
                  onClick={() =>
                    Taro.navigateTo({ url: `/pages/plan/detail/index?moduleKey=${key}` })
                  }
                >
                  <Text>⚙</Text>
                </View>
              )}
            </View>
          )
        })}
      </View>

      <View className="plan-page__footer">
        <Button block type="primary" onClick={handleSave} loading={saving}>
          保存计划
        </Button>
      </View>
    </View>
  )
}
