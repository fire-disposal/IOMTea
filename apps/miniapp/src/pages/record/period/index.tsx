import { Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { FormShell, SegmentPicker } from '../../../components/FormShell'
import { addLocalRecord, getTrendData } from '../../../utils/storage'
import './index.scss'

const FLOW_OPTIONS = [
  { value: 'light', label: '�? },
  { value: 'medium', label: '�? },
  { value: 'heavy', label: '�? },
]

const SYMPTOM_OPTIONS = ['腹痛', '头痛', '乏力', '腰酸', '情绪波动']

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function PeriodRecord() {
  const [flow, setFlow] = useState('medium')
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [trendData, setTrendData] = useState<{ value: number; date: string }[]>([])

  useEffect(() => {
    setTrendData(getTrendData('period', 30))
  }, [])

  const toggleSymptom = useCallback((s: string) => {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }, [])

  const handleSave = useCallback(() => {
    setSaving(true)
    addLocalRecord({
      type: 'period',
      data: { date: formatDate(new Date()), flow, symptoms, notes: notes || null },
      recordedAt: new Date().toISOString(),
    })
    setTrendData(getTrendData('period', 30))
    Taro.vibrateShort()
    setSaving(false)
    setSaved(true)
    setTimeout(() => Taro.navigateBack(), 600)
  }, [flow, symptoms, notes])

  return (
    <FormShell
      title="记录生理�?
      unit=""
      onSave={handleSave}
      saving={saving}
      saved={saved}
      recentData={trendData}
    >
      <View className="period-section">
        <Text className="period-label">日期</Text>
        <Text className="period-date">{formatDate(new Date())}</Text>
      </View>

      <View className="period-section">
        <Text className="period-label">流量</Text>
        <SegmentPicker options={FLOW_OPTIONS} value={flow} onChange={setFlow} />
      </View>

      <View className="period-section">
        <Text className="period-label">症状</Text>
        <View className="period-chips">
          {SYMPTOM_OPTIONS.map((s) => (
            <View
              key={s}
              className={`period-chip ${symptoms.includes(s) ? 'period-chip--active' : ''}`}
              onClick={() => toggleSymptom(s)}
            >
              <Text>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="period-section">
        <Text className="period-label">备注</Text>
        <Input
          className="period-notes"
          value={notes}
          onInput={(e) => setNotes(e.detail.value)}
          placeholder="选填"
        />
      </View>
    </FormShell>
  )
}
