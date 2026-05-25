import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { FormShell, NumberInput } from '../../../components/FormShell'
import { addLocalRecord, getTrendData } from '../../../utils/storage'
import './index.scss'

export default function TemperatureRecord() {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [trendData, setTrendData] = useState<{ value: number; date: string }[]>([])

  useEffect(() => {
    setTrendData(getTrendData('temperature', 7))
  }, [])

  const handleSave = useCallback(() => {
    if (!value || Number(value) <= 0) {
      Taro.showToast({ title: '请输入体温', icon: 'none' })
      return
    }
    setSaving(true)
    addLocalRecord({
      type: 'temperature',
      data: { celsius: Number(value) },
      recordedAt: new Date().toISOString(),
    })
    setTrendData(getTrendData('temperature', 7))
    Taro.vibrateShort()
    setSaving(false)
    setSaved(true)
    setTimeout(() => Taro.navigateBack(), 600)
  }, [value])

  return (
    <FormShell
      title="记录体温"
      unit="°C"
      onSave={handleSave}
      saving={saving}
      saved={saved}
      recentData={trendData}
    >
      <NumberInput value={value} onChange={setValue} decimal placeholder="36.5" />
    </FormShell>
  )
}
