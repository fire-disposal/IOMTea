import { View, Text } from '@tarojs/components'
import { useState, useCallback, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { FormShell, NumberInput, SegmentPicker } from '../../../components/FormShell'
import { addLocalRecord, getTrendData } from '../../../utils/storage'
import './index.scss'

const CONTEXT_OPTIONS = [
  { value: 'fasting', label: '空腹' },
  { value: 'postprandial', label: '餐后' },
  { value: 'bedtime', label: '睡前' },
  { value: 'random', label: '随机' },
]

const MEAL_OPTIONS = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
  { value: 'snack', label: '加餐' },
]

export default function GlucoseRecord() {
  const [value, setValue] = useState('')
  const [context, setContext] = useState('fasting')
  const [mealTag, setMealTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [trendData, setTrendData] = useState<{ value: number; date: string }[]>([])

  useEffect(() => {
    setTrendData(getTrendData('blood_glucose', 7))
  }, [])

  const handleSave = useCallback(() => {
    if (!value || Number(value) <= 0) {
      Taro.showToast({ title: '请输入血糖值', icon: 'none' })
      return
    }
    setSaving(true)
    addLocalRecord({
      type: 'blood_glucose',
      data: { value_mgdl: Number(value), context, meal_tag: mealTag || null },
      recordedAt: new Date().toISOString(),
    })
    setTrendData(getTrendData('blood_glucose', 7))
    Taro.vibrateShort()
    setSaving(false)
    setSaved(true)
    setTimeout(() => Taro.navigateBack(), 600)
  }, [value, context, mealTag])

  return (
    <FormShell
      title="记录血糖"
      unit="mmol/L"
      onSave={handleSave}
      saving={saving}
      saved={saved}
      recentData={trendData}
    >
      <NumberInput value={value} onChange={setValue} decimal placeholder="0.0" />

      <View className="glucose-section">
        <Text className="glucose-label">测量时段</Text>
        <SegmentPicker options={CONTEXT_OPTIONS} value={context} onChange={setContext} />
      </View>

      {context === 'postprandial' && (
        <View className="glucose-section">
          <Text className="glucose-label">餐别</Text>
          <SegmentPicker options={MEAL_OPTIONS} value={mealTag} onChange={setMealTag} />
        </View>
      )}
    </FormShell>
  )
}
