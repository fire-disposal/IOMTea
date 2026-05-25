import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { NumberInput } from '../../../components/FormShell'
import './index.scss'

interface HealthGoals {
  bloodGlucose: { fastingMin: number; fastingMax: number; postprandialMax: number }
  weight: { targetKg: number; minKg: number; maxKg: number }
  bloodPressure: { systolicMax: number; diastolicMax: number }
}

const DEFAULT_GOALS: HealthGoals = {
  bloodGlucose: { fastingMin: 3.9, fastingMax: 7.0, postprandialMax: 10.0 },
  weight: { targetKg: 65, minKg: 55, maxKg: 75 },
  bloodPressure: { systolicMax: 140, diastolicMax: 90 },
}

export default function GoalsSettings() {
  const [goals, setGoals] = useState<HealthGoals>(DEFAULT_GOALS)

  useEffect(() => {
    const stored = Taro.getStorageSync('health_goals')
    if (stored) setGoals(stored)
  }, [])

  const update = useCallback(
    <K extends keyof HealthGoals>(section: K, field: string, value: string) => {
      setGoals((prev) => ({
        ...prev,
        [section]: { ...prev[section], [field]: Number(value) },
      }))
    },
    [],
  )

  const save = () => {
    Taro.setStorageSync('health_goals', goals)
    Taro.showToast({ title: '已保存', icon: 'success' })
  }

  return (
    <View className="goals-page">
      <View className="goals-page__header">
        <Text className="goals-page__back" onClick={() => Taro.navigateBack()}>
          ← 返回
        </Text>
        <Text className="goals-page__title">健康目标</Text>
      </View>

      <View className="goals-section">
        <Text className="goals-section__title">血糖目标</Text>
        <View className="goals-field">
          <Text className="goals-field__label">空腹血糖最低 (mmol/L)</Text>
          <NumberInput
            value={String(goals.bloodGlucose.fastingMin)}
            onChange={(v) => update('bloodGlucose', 'fastingMin', v)}
            decimal
          />
        </View>
        <View className="goals-field">
          <Text className="goals-field__label">空腹血糖最高 (mmol/L)</Text>
          <NumberInput
            value={String(goals.bloodGlucose.fastingMax)}
            onChange={(v) => update('bloodGlucose', 'fastingMax', v)}
            decimal
          />
        </View>
        <View className="goals-field">
          <Text className="goals-field__label">餐后血糖最高 (mmol/L)</Text>
          <NumberInput
            value={String(goals.bloodGlucose.postprandialMax)}
            onChange={(v) => update('bloodGlucose', 'postprandialMax', v)}
            decimal
          />
        </View>
      </View>

      <View className="goals-section">
        <Text className="goals-section__title">体重目标</Text>
        <View className="goals-field">
          <Text className="goals-field__label">目标体重 (kg)</Text>
          <NumberInput
            value={String(goals.weight.targetKg)}
            onChange={(v) => update('weight', 'targetKg', v)}
            decimal
          />
        </View>
        <View className="goals-field">
          <Text className="goals-field__label">最低体重 (kg)</Text>
          <NumberInput
            value={String(goals.weight.minKg)}
            onChange={(v) => update('weight', 'minKg', v)}
            decimal
          />
        </View>
        <View className="goals-field">
          <Text className="goals-field__label">最高体重 (kg)</Text>
          <NumberInput
            value={String(goals.weight.maxKg)}
            onChange={(v) => update('weight', 'maxKg', v)}
            decimal
          />
        </View>
      </View>

      <View className="goals-section">
        <Text className="goals-section__title">血压目标</Text>
        <View className="goals-field">
          <Text className="goals-field__label">收缩压上限 (mmHg)</Text>
          <NumberInput
            value={String(goals.bloodPressure.systolicMax)}
            onChange={(v) => update('bloodPressure', 'systolicMax', v)}
          />
        </View>
        <View className="goals-field">
          <Text className="goals-field__label">舒张压上限 (mmHg)</Text>
          <NumberInput
            value={String(goals.bloodPressure.diastolicMax)}
            onChange={(v) => update('bloodPressure', 'diastolicMax', v)}
          />
        </View>
      </View>

      <Button className="goals-page__save" onClick={save}>
        保存
      </Button>
    </View>
  )
}
