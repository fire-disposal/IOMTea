import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useMemo } from 'react'
import { getLocalRecords } from '../../utils/storage'
import { TabBar } from '../../components/TabBar'
import './index.scss'

const QUICK = [
  { key: 'blood_glucose', label: '血糖', icon: '🩸', page: '/pages/record/glucose/index' },
  { key: 'blood_pressure', label: '血压', icon: '❤️', page: '/pages/record/pressure/index' },
  { key: 'weight', label: '体重', icon: '⚖️', page: '/pages/record/weight/index' },
  { key: 'medication', label: '用药', icon: '💊', page: '/pages/record/medication/index' },
]

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const GREETINGS = [
  { start: 5, end: 12, text: '早上好' },
  { start: 12, end: 14, text: '中午好' },
  { start: 14, end: 18, text: '下午好' },
  { start: 18, end: 25, text: '晚上好' },
]

function getGreeting(): string {
  const hour = new Date().getHours()
  for (const g of GREETINGS) {
    if (hour >= g.start && hour < g.end) return g.text
  }
  return '晚上好'
}

const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function formatDateZh(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  const w = WEEKDAY_NAMES[now.getDay()]
  return `${y}年${m}月${d}日 ${w}`
}

export default function Index() {
  const [totalToday, setTotalToday] = useState(0)
  const [weeklyData, setWeeklyData] = useState<Map<string, string[]>>(new Map())
  const userName = Taro.getStorageSync('user_name') || '用户'

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    const all = getLocalRecords()
    setTotalToday(all.filter(r => r.recordedAt.startsWith(today)).length)

    const grouped = new Map<string, string[]>()
    for (const r of all) {
      const date = r.recordedAt.slice(0, 10)
      if (!grouped.has(date)) grouped.set(date, [])
      const types = grouped.get(date)!
      if (!types.includes(r.type)) types.push(r.type)
    }
    setWeeklyData(grouped)
  }, [])

  const weekDays = useMemo(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      return {
        date: dateStr,
        weekday: WEEKDAYS[i],
        day: d.getDate(),
        isToday: dateStr === now.toISOString().slice(0, 10),
        records: weeklyData.get(dateStr) || [],
      }
    })
  }, [weeklyData])

  return (
    <View className='home-page animation-fade'>
      <View className='home-page__header'>
        <Text className='home-page__greeting'>{getGreeting()}，{userName}</Text>
        <Text className='home-page__date'>{formatDateZh()}</Text>
      </View>
      <View className='home-page__summary'>
        <Text className='home-page__summary-num'>{totalToday}</Text>
        <Text className='home-page__summary-label'>今日记录</Text>
      </View>
      <View className='home-page__week'>
        <Text className='home-page__section-title'>本周动态</Text>
        <View className='home-page__week-strip'>
          {weekDays.map(d => (
            <View key={d.date} className={`week-day ${d.isToday ? 'week-day--today' : ''}`}>
              <Text className='week-day__name'>{d.weekday}</Text>
              <Text className='week-day__num'>{d.day}</Text>
              {d.records.length > 0 && <View className='week-day__dot' />}
            </View>
          ))}
        </View>
      </View>
      <View className='home-page__quick'>
        <Text className='home-page__section-title'>快速记录</Text>
        <View className='home-page__quick-grid'>
          {QUICK.map(q => (
            <View key={q.key} className='quick-btn' onClick={() => Taro.navigateTo({ url: q.page })}>
              <Text className='quick-btn__icon'>{q.icon}</Text>
              <Text className='quick-btn__label'>{q.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <TabBar current='index' />
    </View>
  )
}
