import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { FormShell, NumberInput } from '../../../components/FormShell'
import { addLocalRecord, getTrendData } from '../../../utils/storage'
import './index.scss'

export default function PressureRecord() {
  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [trendData, setTrendData] = useState<{ value: number; date: string }[]>([])

  useEffect(() => {
    setTrendData(getTrendData('blood_pressure', 7))
  }, [])

  const handleSave = useCallback(() => {
    if (!systolic || !diastolic) {
      Taro.showToast({ title: '请输入收缩压和舒张压', icon: 'none' })
      return
    }
    setSaving(true)
    addLocalRecord({
      type: 'blood_pressure',
      data: {
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        heart_rate: heartRate ? Number(heartRate) : null,
      },
      recordedAt: new Date().toISOString(),
    })
    setTrendData(getTrendData('blood_pressure', 7))
    Taro.vibrateShort()
    setSaving(false)
    setSaved(true)
    setTimeout(() => Taro.navigateBack(), 600)
  }, [systolic, diastolic, heartRate])

  return (
    <FormShell
      title="记录血�?
      unit="mmHg"
      onSave={handleSave}
      saving={saving}
      saved={saved}
      recentData={trendData}
    >
      <View className="pressure-grid">
        <View className="pressure-field">
          <NumberInput value={systolic} onChange={setSystolic} placeholder="120" />
          <Text className="pressure-label">收缩�?/Text>
        </View>
        <View className="pressure-field">
          <NumberInput value={diastolic} onChange={setDiastolic} placeholder="80" />
          <Text className="pressure-label">舒张�?/Text>
        </View>
      </View>
      <View className="pressure-hr">
        <NumberInput value={heartRate} onChange={setHeartRate} placeholder="72" />
        <Text className="pressure-label">心率 (bpm)</Text>
      </View>
    </FormShell>
  )
}
