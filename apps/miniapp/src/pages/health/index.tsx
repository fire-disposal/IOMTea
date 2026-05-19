import { View, Text, ScrollView } from '@tarojs/components'
import { Cell, CellGroup, Tag, Skeleton } from '@nutui/nutui-react'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getLocalRecords } from '../../utils/storage'
import { Calendar } from '../../components/Calendar'
import { TabBar } from '../../components/TabBar'
import { HEALTH_MODULE_META, HEALTH_MODULE_KEYS, type HealthModuleKey } from '../../constants/modules'
import './index.scss'

function getRecordPage(key: string): string {
  const pages: Record<string, string> = {
    blood_glucose: '/pages/record/glucose/index',
    blood_pressure: '/pages/record/pressure/index',
    weight: '/pages/record/weight/index',
    heart_rate: '/pages/record/heart-rate/index',
    temperature: '/pages/record/temperature/index',
    spo2: '/pages/record/spo2/index',
    medication: '/pages/record/medication/index',
    period: '/pages/record/period/index',
  }
  return pages[key] || ''
}

export default function HealthPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [activityData, setActivityData] = useState<Map<string, string[]>>(new Map())
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1)
  const [calVisible, setCalVisible] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const trackingConfig = Taro.getStorageSync('tracking_config') || {}
  const modules = HEALTH_MODULE_KEYS
    .filter((k) => trackingConfig[k]?.enabled !== false)
    .map((k) => ({
      key: k,
      ...HEALTH_MODULE_META[k],
      page: getRecordPage(k),
    }))

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