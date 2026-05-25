import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { FormShell, NumberInput, SegmentPicker } from '../../../components/FormShell'
import { addLocalRecord, getTrendData } from '../../../utils/storage'
import './index.scss'

const TOGGLE_OPTIONS = [
  { value: 'no', label: '仅体�? },
  { value: 'yes', label: '含体�? },
]

export default function WeightRecord() {
  const [weight, setWeight] = useState('')
  const [showFat, setShowFat] = useState('no')
  const [bodyFat, setBodyFat] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [trendData, setTrendData] = useState<{ value: number; date: string }[]>([])

  useEffect(() => {
    setTrendData(getTrendData('weight', 7))
  }, [])

  const handleSave = useCallback(() => {
    if (!weight) {
      Taro.showToast({ title: '请输入体�?, icon: 'none' })
      return
    }
    setSaving(true)
    addLocalRecord({
      type: 'weight',
      data: {
        weight_kg: Number(weight),
        body_fat_pct: showFat === 'yes' && bodyFat ? Number(bodyFat) : null,
      },
      recordedAt: new Date().toISOString(),
    })
    setTrendData(getTrendData('weight', 7))
    Taro.vibrateShort()
    setSaving(false)
    setSaved(true)
    setTimeout(() => Taro.navigateBack(), 600)
  }, [weight, showFat, bodyFat])

  return (
    <FormShell
      title="记录体重"
      unit="kg"
      onSave={handleSave}
      saving={saving}
      saved={saved}
      recentData={trendData}
    >
      <NumberInput value={weight} onChange={setWeight} decimal placeholder="65.0" />

      <View className="weight-section">
        <SegmentPicker options={TOGGLE_OPTIONS} value={showFat} onChange={setShowFat} />
      </View>

      {showFat === 'yes' && (
        <View className="weight-section">
          <NumberInput value={bodyFat} onChange={setBodyFat} decimal placeholder="20.0" />
          <Text className="weight-label">体脂�?(%)</Text>
        </View>
      )}
    </FormShell>
  )
}
