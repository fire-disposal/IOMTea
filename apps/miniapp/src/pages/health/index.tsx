import { View, Text, ScrollView } from '@tarojs/components'
import { Cell, CellGroup, Tag, Skeleton } from '@nutui/nutui-react'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getLocalRecords } from '../../utils/storage'
import { Calendar } from '../../components/Calendar'
import { TabBar } from '../../components/TabBar'
import './index.scss'

const ALL_MODULES = [
  { key: 'blood_glucose', label: '血糖', unit: 'mmol/L', icon: '🩸', page: '/pages/record/glucose/index' },
  { key: 'blood_pressure', label: '血压', unit: 'mmHg', icon: '❤️', page: '/pages/record/pressure/index' },
  { key: 'weight', label: '体重', unit: 'kg', icon: '⚖️', page: '/pages/record/weight/index' },
  { key: 'heart_rate', label: '心率', unit: 'bpm', icon: '💓', page: '/pages/record/heart-rate/index' },
  { key: 'temperature', label: '体温', unit: '°C', icon: '🌡️', page: '/pages/record/temperature/index' },
  { key: 'spo2', label: '血氧', unit: '%', icon: '🫁', page: '/pages/record/spo2/index' },
  { key: 'medication', label: '用药', unit: '', icon: '💊', page: '/pages/record/medication/index' },
  { key: 'period', label: '生理期', unit: '', icon: '🌸', page: '/pages/record/period/index' },
]

export default function HealthPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [activityData, setActivityData] = useState<Map<string, string[]>>(new Map())
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1)
  const [calVisible, setCalVisible] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const trackingConfig = Taro.getStorageSync('tracking_config') || {}
  const modules = ALL_MODULES.filter((m) => trackingConfig[m.key]?.enabled !== false)

  useEffect(() => {
    const all = getLocalRecords()
    const today = new Date().toISOString().slice(0, 10)
    const c: Record<string, number> = {}
    const grouped = new Map<string, string[]>()
    for (const r of all) {
      c[r.type] = (c[r.type] || 0) + (r.recordedAt.startsWith(today) ? 1 : 0)
      const date = r.recordedAt.slice(0, 10)
      if (!grouped.has(date)) grouped.set(date, [])
      const types = grouped.get(date)!
      if (!types.includes(r.type)) types.push(r.type)
    }
    setCounts(c); setActivityData(grouped); setLoaded(true)
  }, [])

  return (
    <View className='health-page'>
      <ScrollView className='health-scroll' scrollY>
        <View className='health-header'>
          <Text className='health-title'>健康记录</Text>
          <Text className='health-gear' onClick={() => Taro.navigateTo({ url: '/pages/settings/tracking/index' })}>⚙️</Text>
        </View>

        <View className='health-cal-toggle' onClick={() => setCalVisible((v) => !v)}>
          <Text>{calVisible ? '收起日历 ▲' : '展开日历 ▼'}</Text>
        </View>

        {calVisible && (
          <View className='anim-fade-up'>
            <Calendar year={calYear} month={calMonth} activityData={activityData}
              onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m) }}
              onDayClick={(date) => Taro.showModal({ title: date, content: `${activityData.get(date)?.length || 0} 条记录`, showCancel: false })} />
          </View>
        )}

        {!loaded ? (
          <CellGroup className='anim-stagger'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Cell key={i} title={<Skeleton width='120px' height='20px' animated />} />
            ))}
          </CellGroup>
        ) : (
          <CellGroup className='anim-stagger'>
            {modules.map((m) => (
              <Cell
                key={m.key}
                title={m.label}
                description={m.unit ? `记录${m.unit}` : '记录'}
                extra={<Tag type={counts[m.key] > 0 ? 'primary' : 'default'}>{counts[m.key] > 0 ? `今日 ${counts[m.key]} 次` : '未记录'}</Tag>}
                onClick={() => Taro.navigateTo({ url: m.page })}
              />
            ))}
          </CellGroup>
        )}
      </ScrollView>
      <TabBar current='health' />
    </View>
  )
}