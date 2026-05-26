import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { FormShell, NumberInput } from '../../../components/FormShell'
import { STORAGE_KEYS } from '../../../constants/storage-keys'
import { api } from '../../../utils/api'
import { syncUnsyncedRecords } from '../../../utils/sync'
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
    const router = Taro.useRouter()
    const planId = router.params.planId
    if (planId) {
      const patientId = Taro.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''
      api.post(`/plans/${planId}/complete`, { patientId }).catch(() => {})
    }
    syncUnsyncedRecords()
    setTrendData(getTrendData('blood_pressure', 7))
    Taro.vibrateShort()
    setSaving(false)
    setSaved(true)
    setTimeout(() => Taro.navigateBack(), 600)
  }, [systolic, diastolic, heartRate])

  return (
    <FormShell
      title="记录血压"
      unit="mmHg"
      onSave={handleSave}
      saving={saving}
      saved={saved}
      recentData={trendData}
    >
      <View className="pressure-grid">
        <View className="pressure-field">
          <NumberInput value={systolic} onChange={setSystolic} placeholder="120" />
          <Text className="pressure-label">收缩压</Text>
        </View>
        <View className="pressure-field">
          <NumberInput value={diastolic} onChange={setDiastolic} placeholder="80" />
          <Text className="pressure-label">舒张压</Text>
        </View>
      </View>
      <View className="pressure-hr">
        <NumberInput value={heartRate} onChange={setHeartRate} placeholder="72" />
        <Text className="pressure-label">心率 (bpm)</Text>
      </View>
    </FormShell>
  )
}
