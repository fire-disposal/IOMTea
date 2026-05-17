import { View, Text, Switch } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import './index.scss'

const ALL_MODULES = [
  { key: 'blood_glucose', label: '血糖', icon: '🩸' },
  { key: 'blood_pressure', label: '血压', icon: '❤️' },
  { key: 'weight', label: '体重', icon: '⚖️' },
  { key: 'heart_rate', label: '心率', icon: '💓' },
  { key: 'temperature', label: '体温', icon: '🌡️' },
  { key: 'spo2', label: '血氧', icon: '🫁' },
  { key: 'medication', label: '用药', icon: '💊' },
  { key: 'period', label: '生理期', icon: '🌸' },
]

const REMINDER_TIMES = ['早', '中', '晚', '睡前']

interface ModuleConfig {
  enabled: boolean
  reminderTimes: string[]
}

export default function TrackingSettings() {
  const [config, setConfig] = useState<Record<string, ModuleConfig>>({})

  useEffect(() => {
    const saved = Taro.getStorageSync('tracking_config') || {}
    const initial: Record<string, ModuleConfig> = {}
    for (const m of ALL_MODULES) {
      initial[m.key] = saved[m.key] || { enabled: true, reminderTimes: [] }
    }
    setConfig(initial)
  }, [])

  const toggle = (key: string) => {
    const next = { ...config, [key]: { ...config[key], enabled: !config[key].enabled } }
    setConfig(next)
    Taro.setStorageSync('tracking_config', next)
  }

  const toggleReminder = (key: string, time: string) => {
    const c = config[key]
    const times = c.reminderTimes.includes(time)
      ? c.reminderTimes.filter(t => t !== time)
      : [...c.reminderTimes, time]
    const next = { ...config, [key]: { ...c, reminderTimes: times } }
    setConfig(next)
    Taro.setStorageSync('tracking_config', next)
  }

  return (
    <View className='tracking-page'>
      <View className='tracking-page__header'>
        <Text className='tracking-page__back' onClick={() => Taro.navigateBack()}>← 返回</Text>
        <Text className='tracking-page__title'>记录项目设置</Text>
      </View>
      {ALL_MODULES.map(m => (
        <View key={m.key} className='tracking-item'>
          <View className='tracking-item__row'>
            <Text className='tracking-item__icon'>{m.icon}</Text>
            <Text className='tracking-item__label'>{m.label}</Text>
            <Switch checked={config[m.key]?.enabled ?? true} onClick={() => toggle(m.key)} />
          </View>
          {config[m.key]?.enabled && (
            <View className='tracking-item__reminders'>
              {REMINDER_TIMES.map(t => (
                <View key={t}
                  className={`tracking-chip ${config[m.key]?.reminderTimes.includes(t) ? 'tracking-chip--active' : ''}`}
                  onClick={() => toggleReminder(m.key, t)}>
                  <Text>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  )
}
