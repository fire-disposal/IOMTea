import { View, Text } from '@tarojs/components'
import { useState, useCallback, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { FormShell, NumberInput, SegmentPicker } from '../../../components/FormShell'
import { addLocalRecord, getTrendData } from '../../../utils/storage'
import './index.scss'

const CONTEXT_OPTIONS = [
  { value: 'resting', label: '静息' },
  { value: 'after_exercise', label: '运动后' },
  { value: 'random', label: '随机' },
]

export default function HeartRateRecord() {
  const [value, setValue] = useState('')
  const [context, setContext] = useState('resting')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [trendData, setTrendData] = useState<{ value: number; date: string }[]>([])

  useEffect(() => {
    setTrendData(getTrendData('heart_rate', 7))
  }, [])

  const handleSave = useCallback(() => {
    if (!value || Number(value) <= 0) {
      Taro.showToast({ title: '请输入心率', icon: 'none' })
      return
    }
    setSaving(true)
    addLocalRecord({
      type: 'heart_rate',
      data: { bpm: Number(value), context },
      recordedAt: new Date().toISOString(),
    })
    setTrendData(getTrendData('heart_rate', 7))
    Taro.vibrateShort()
    setSaving(false)
    setSaved(true)
    setTimeout(() => Taro.navigateBack(), 600)
  }, [value, context])

  return (
    <FormShell
      title="记录心率"
      unit="bpm"
      onSave={handleSave}
      saving={saving}
      saved={saved}
      recentData={trendData}
    >
      <NumberInput value={value} onChange={setValue} placeholder="72" />

      <View className="hr-section">
        <Text className="hr-label">测量情境</Text>
        <SegmentPicker options={CONTEXT_OPTIONS} value={context} onChange={setContext} />
      </View>
    </FormShell>
  )
}
