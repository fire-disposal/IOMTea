import { useState, useCallback, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { FormShell, NumberInput } from '../../components/FormShell'
import { addLocalRecord, getTrendData } from '../../utils/storage'
import './index.scss'

export default function Spo2Record() {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [trendData, setTrendData] = useState<{ value: number; date: string }[]>([])

  useEffect(() => {
    setTrendData(getTrendData('spo2', 7))
  }, [])

  const handleSave = useCallback(() => {
    if (!value || Number(value) <= 0 || Number(value) > 100) {
      Taro.showToast({ title: '请输入有效血氧值 (0-100)', icon: 'none' })
      return
    }
    setSaving(true)
    addLocalRecord({
      type: 'spo2',
      data: { percentage: Number(value) },
      recordedAt: new Date().toISOString(),
    })
    setTrendData(getTrendData('spo2', 7))
    Taro.vibrateShort()
    setSaving(false)
    setSaved(true)
    setTimeout(() => Taro.navigateBack(), 600)
  }, [value])

  return (
    <FormShell title='记录血氧' unit='%' onSave={handleSave} saving={saving} saved={saved} recentData={trendData}>
      <NumberInput value={value} onChange={setValue} placeholder='98' />
    </FormShell>
  )
}
