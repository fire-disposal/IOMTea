// @ts-nocheck
import { Button, DatePicker } from '@nutui/nutui-react'
import { Checkbox, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { HEALTH_MODULE_META, type HealthModuleKey } from '../../../constants/modules'
import { trpc } from '../../../utils/trpc'
import './index.scss'

interface ReminderSlot {
  label: string
  hour: number
  min: number
  enabled: boolean
}

const DEFAULT_SLOTS: ReminderSlot[] = [
  { label: '早晨', hour: 8, min: 0, enabled: false },
  { label: '中午', hour: 12, min: 30, enabled: false },
  { label: '晚上', hour: 18, min: 0, enabled: false },
  { label: '睡前', hour: 22, min: 0, enabled: false },
]

export default function PlanDetailPage() {
  const router = useRouter()
  const moduleKey = (router.params.moduleKey || '') as HealthModuleKey
  const meta = HEALTH_MODULE_META[moduleKey]

  const [slots, setSlots] = useState<ReminderSlot[]>(DEFAULT_SLOTS)
  const [frequency, setFrequency] = useState<'daily' | 'multiple'>('daily')
  const [saving, setSaving] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [editingSlot, setEditingSlot] = useState<number>(-1)

  useEffect(() => {
    trpc.plan.get
      .query()
      .then((plan: any) => {
        if (plan?.items) {
          const item = plan.items.find((i: any) => i.moduleKey === moduleKey)
          if (item) {
            setFrequency(item.frequency || 'daily')
            if (item.reminderTimes?.length > 0) {
              const loaded = item.reminderTimes.map((t: any, i: number) => ({
                label: DEFAULT_SLOTS[i]?.label || `时段${i + 1}`,
                hour: t.hour,
                min: t.min,
                enabled: true,
              }))
              while (loaded.length < DEFAULT_SLOTS.length) {
                loaded.push({ ...DEFAULT_SLOTS[loaded.length] })
              }
              setSlots(loaded)
            }
          }
        }
      })
      .catch(() => {})
  }, [moduleKey])

  const save = async () => {
    setSaving(true)
    try {
      const enabledSlots = slots.filter((s) => s.enabled)
      const plan = await trpc.plan.get.query()
      if (plan?.items) {
        const currentItems = plan.items.map((i: any) => ({
          moduleKey: i.moduleKey,
          enabled: i.enabled,
          reminderEnabled: i.moduleKey === moduleKey ? enabledSlots.length > 0 : i.reminderEnabled,
          reminderTimes:
            i.moduleKey === moduleKey
              ? enabledSlots.map((s) => ({ hour: s.hour, min: s.min }))
              : i.reminderTimes,
          frequency: i.moduleKey === moduleKey ? frequency : i.frequency,
          sortOrder: i.sortOrder,
        }))
        await trpc.plan.upsert.mutate({ items: currentItems })
      }
      Taro.showToast({ title: '已保�?, icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="plan-detail">
      <View className="plan-detail__header">
        <Text className="plan-detail__back" onClick={() => Taro.navigateBack()}>
          �?返回
        </Text>
        <Text className="plan-detail__title">{meta?.label} · 提醒设置</Text>
        <View style={{ width: 48 }} />
      </View>

      <View className="plan-detail__section">
        <Text className="plan-detail__section-title">提醒时段</Text>
        {slots.map((slot, i) => (
          <View key={i} className="reminder-slot">
            <View
              className="reminder-slot__left"
              onClick={() => {
                setSlots((prev) =>
                  prev.map((s, j) => (j === i ? { ...s, enabled: !s.enabled } : s)),
                )
              }}
            >
              <Checkbox value={String(i)} checked={slot.enabled} />
              <Text className="reminder-slot__label">{slot.label}</Text>
            </View>
            {slot.enabled && (
              <Text
                className="reminder-slot__time"
                onClick={() => {
                  setEditingSlot(i)
                  setPickerVisible(true)
                }}
              >
                {String(slot.hour).padStart(2, '0')}:{String(slot.min).padStart(2, '0')}
              </Text>
            )}
          </View>
        ))}
      </View>

      <DatePicker
        visible={pickerVisible}
        title="选择时间"
        type="hour-minutes"
        value={
          editingSlot >= 0
            ? new Date(2024, 0, 1, slots[editingSlot].hour, slots[editingSlot].min)
            : new Date(2024, 0, 1, 8, 0)
        }
        onConfirm={(_options: any, values: any[]) => {
          const v0 = values[0] as Date
          const hour = v0.getHours()
          const min = v0.getMinutes()
          setSlots((prev) => prev.map((s, j) => (j === editingSlot ? { ...s, hour, min } : s)))
          setPickerVisible(false)
        }}
        onClose={() => setPickerVisible(false)}
      />

      <View className="plan-detail__footer">
        <Button block type="primary" onClick={save} loading={saving}>
          保存
        </Button>
      </View>
    </View>
  )
}
