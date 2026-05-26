import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { STORAGE_KEYS } from '../../../constants/storage-keys'
import { api } from '../../../utils/api'
import { syncUnsyncedRecords } from '../../../utils/sync'
import { addLocalRecord } from '../../../utils/storage'
import './index.scss'

interface MedItem {
  id: string
  drug: string
  dosage: string
  scheduled_time: string
  taken?: boolean
  skipped?: boolean
}

export default function MedicationRecord() {
  const [meds, setMeds] = useState<MedItem[]>([])
  const [loading, setLoading] = useState(true)
  const patientId = Taro.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''

  useEffect(() => {
    if (!Taro.getStorageSync(STORAGE_KEYS.TOKEN)) return
    api
      .get<{ id: string; code: string; title: string; rewardCredits: number }[]>('/plans/today', {
        patientId,
      })
      .then((plans) => {
        const medPlans = (plans || []).filter(
          (p) => p.code === 'medication' || p.code === 'medication_schedule',
        )
        if (medPlans.length > 0) {
          setMeds(
            medPlans.map((p) => ({
              id: p.id,
              drug: p.title,
              dosage: '',
              scheduled_time: '今日',
            })),
          )
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const handleTake = useCallback(
    (id: string) => {
      setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, taken: true, skipped: false } : m)))
      const med = meds.find((m) => m.id === id)
      if (med) {
        addLocalRecord({
          type: 'medication',
          data: {
            drug: med.drug,
            dosage: med.dosage,
            scheduled_time: med.scheduled_time,
            action: 'taken',
          },
          recordedAt: new Date().toISOString(),
        })
      }
      const router = Taro.useRouter()
      const planId = router.params.planId
      if (planId) {
        api.post(`/plans/${planId}/complete`, { patientId }).catch(() => {})
      }
      syncUnsyncedRecords()
      Taro.vibrateShort()
      Taro.showToast({ title: '已记录', icon: 'success' })
    },
    [meds, patientId],
  )

  const handleSkip = useCallback(
    (id: string) => {
      setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, taken: false, skipped: true } : m)))
      const med = meds.find((m) => m.id === id)
      if (med) {
        addLocalRecord({
          type: 'medication',
          data: {
            drug: med.drug,
            dosage: med.dosage,
            scheduled_time: med.scheduled_time,
            action: 'skipped',
          },
          recordedAt: new Date().toISOString(),
        })
      }
      const router = Taro.useRouter()
      const planId = router.params.planId
      if (planId) {
        api.post(`/plans/${planId}/complete`, { patientId }).catch(() => {})
      }
      syncUnsyncedRecords()
      Taro.showToast({ title: '已跳过', icon: 'none' })
    },
    [meds, patientId],
  )

  return (
    <View className="med-page">
      <View className="med-header">
        <Text className="med-title">今日用药</Text>
      </View>
      <ScrollView className="med-list" scrollY>
        {loading && <Text className="empty">加载中...</Text>}
        {!loading && meds.length === 0 && (
          <View className="med-empty">
            <Text>暂无用药计划</Text>
            <Text className="med-empty-hint">请通过 Web 端添加用药方案</Text>
          </View>
        )}
        {meds.map((med) => (
          <View
            key={med.id}
            className={`med-item ${med.taken ? 'med-item--taken' : ''} ${med.skipped ? 'med-item--skipped' : ''}`}
          >
            <View className="med-info">
              <Text className="med-drug">{med.drug}</Text>
              <Text className="med-dosage">{med.dosage}</Text>
              <Text className="med-time">{med.scheduled_time}</Text>
            </View>
            <View className="med-actions">
              {!med.taken && !med.skipped && (
                <>
                  <View className="med-btn med-btn--take" onClick={() => handleTake(med.id)}>
                    <Text>已服用</Text>
                  </View>
                  <View className="med-btn med-btn--skip" onClick={() => handleSkip(med.id)}>
                    <Text>跳过</Text>
                  </View>
                </>
              )}
              {med.taken && <Text className="med-status med-status--taken">已服用</Text>}
              {med.skipped && <Text className="med-status med-status--skipped">已跳过</Text>}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
