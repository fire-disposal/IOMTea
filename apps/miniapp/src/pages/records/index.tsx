import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getLocalRecords, HealthRecord } from '../../utils/storage'
import './index.scss'

const TYPE_LABELS: Record<string, string> = {
  blood_glucose: '血糖',
  blood_pressure: '血压',
  weight: '体重',
  heart_rate: '心率',
  temperature: '体温',
  spo2: '血氧',
  medication: '用药',
  period: '生理期',
}

const GLUCOSE_CONTEXT_LABELS: Record<string, string> = {
  fasting: '空腹',
  postprandial: '餐后',
  bedtime: '睡前',
  random: '随机',
}

const HR_CONTEXT_LABELS: Record<string, string> = {
  resting: '静息',
  after_exercise: '运动后',
  random: '随机',
}

const FLOW_LABELS: Record<string, string> = {
  light: '轻',
  medium: '中',
  heavy: '重',
}

function formatRecordContent(r: HealthRecord): string {
  switch (r.type) {
    case 'blood_glucose': {
      const ctx = GLUCOSE_CONTEXT_LABELS[r.data.context as string] || r.data.context
      return `值: ${r.data.value_mgdl} mmol/L · ${ctx}`
    }
    case 'blood_pressure': {
      let s = `${r.data.systolic}/${r.data.diastolic} mmHg`
      if (r.data.heart_rate != null) s += ` · HR ${r.data.heart_rate}`
      return s
    }
    case 'weight': {
      let s = `${r.data.weight_kg} kg`
      if (r.data.body_fat_pct != null) s += ` · 体脂 ${r.data.body_fat_pct}%`
      return s
    }
    case 'heart_rate': {
      const ctx = HR_CONTEXT_LABELS[r.data.context as string] || r.data.context
      return `${r.data.bpm} bpm · ${ctx}`
    }
    case 'temperature':
      return `${r.data.celsius} °C`
    case 'spo2':
      return `${r.data.percentage}%`
    case 'medication':
      return `${r.data.drug} · ${r.data.action === 'taken' ? '已服用' : '已跳过'}`
    case 'period': {
      const d = r.data as {
        flow?: string
        symptoms?: string[]
        notes?: string | null
        date?: string
      }
      const parts: string[] = []
      if (d.flow) parts.push(`流量 ${FLOW_LABELS[d.flow] || d.flow}`)
      if (d.symptoms?.length) parts.push(d.symptoms.join(', '))
      return parts.join(' · ')
    }
    default:
      return ''
  }
}

export default function RecordsPage() {
  const router = Taro.useRouter()
  const type = router.params.type || ''
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const all = getLocalRecords(type)
    all.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
    setRecords(all)
    setLoading(false)
  }, [type])

  const label = TYPE_LABELS[type] || '记录'

  return (
    <View className="records-page animation-fade">
      <View className="records-page__header">
        <Text className="records-page__back" onClick={() => Taro.navigateBack()}>
          ← 返回
        </Text>
        <Text className="records-page__title">{label}历史</Text>
      </View>
      {loading ? (
        <View className="records-page__skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} className="record-item-skeleton" />
          ))}
        </View>
      ) : records.length === 0 ? (
        <View className="records-page__empty">
          <View className="records-page__empty-icon">📋</View>
          <Text className="records-page__empty-text">暂无记录</Text>
          <Text className="records-page__empty-hint">开始记录你的第一条健康数据</Text>
          <View className="records-page__empty-btn" onClick={() => Taro.navigateBack()}>
            去记录
          </View>
        </View>
      ) : (
        <View className="records-page__list">
          {records.map((r) => (
            <View key={r.id} className="record-item">
              <Text className="record-item__time">
                {new Date(r.recordedAt).toLocaleString('zh-CN')}
              </Text>
              <Text className="record-item__value">{formatRecordContent(r)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
