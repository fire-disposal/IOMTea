import { View, Text } from '@tarojs/components'
import { Badge, Grid, GridItem } from '@nutui/nutui-react'
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

const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return '早上好'
  if (hour >= 12 && hour < 14) return '中午好'
  if (hour >= 14 && hour < 18) return '下午好'
  return '晚上好'
}

function formatDateZh(): string {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAY_NAMES[now.getDay()]}`
}

export default function Index() {
  const [totalToday, setTotalToday] = useState(0)
  const [weeklyData, setWeeklyData] = useState<Map<string, string[]>>(new Map())
  const userName = Taro.getStorageSync('user_name') || '用户'

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) { Taro.redirectTo({ url: '/pages/login/index' }); return }
    const today = new Date().toISOString().slice(0, 10)
    const all = getLocalRecords()
    setTotalToday(all.filter((r) => r.recordedAt.startsWith(today)).length)

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
    const start = new Date(now); start.setDate(now.getDate() - 6)
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      return { date: dateStr, day: d.getDate(), isToday: dateStr === now.toISOString().slice(0, 10), records: weeklyData.get(dateStr) || [] }
    })
  }, [weeklyData])

  return (
    <View className='home-page'>
      <View className='home-header anim-fade-up'>
        <Text className='home-greeting'>{getGreeting()}，{userName}</Text>
        <Text className='home-date'>{formatDateZh()}</Text>
      </View>

      <View className='home-summary anim-scale-in' style='animation-delay:100ms'>
        <Text className='home-summary-num'>{totalToday}</Text>
        <Text className='home-summary-label'>今日记录</Text>
      </View>

      <View className='home-week anim-fade-up' style='animation-delay:200ms'>
        <Text className='home-section-title'>本周动态</Text>
        <View className='week-strip'>
          {weekDays.map((d) => (
            <View key={d.date} className={`week-day ${d.isToday ? 'week-day--today' : ''}`}>
              <Text className='week-day__num'>{d.day}</Text>
              {d.records.length > 0 && <View className='week-day__dot' />}
            </View>
          ))}
        </View>
      </View>

      <View className='home-quick anim-fade-up' style='animation-delay:300ms'>
        <Text className='home-section-title'>快速记录</Text>
        <Grid columns={2} className='anim-stagger'>
          {QUICK.map((q) => (
            <GridItem key={q.key} text={q.label} onClick={() => Taro.navigateTo({ url: q.page })}>
              <Text style='font-size:36px'>{q.icon}</Text>
            </GridItem>
          ))}
        </Grid>
      </View>

      <TabBar current='index' />
    </View>
  )
}