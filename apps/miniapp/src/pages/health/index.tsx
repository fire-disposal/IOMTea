import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { Calendar } from '../../components/Calendar'
import { TabBar } from '../../components/TabBar'
import {
  HEALTH_MODULE_KEYS,
  HEALTH_MODULE_META,
  type HealthModuleKey,
  getRecordPage,
} from '../../constants/modules'
import { getLocalRecords } from '../../utils/storage'
import './index.scss'

export default function HealthPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [activityData, setActivityData] = useState<Map<string, string[]>>(new Map())
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1)
  const [calVisible, setCalVisible] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const trackingConfig = Taro.getStorageSync('tracking_config') || {}
  const modules = HEALTH_MODULE_KEYS.filter((k) => trackingConfig[k]?.enabled !== false).map(
    (k) => ({
      key: k,
      ...HEALTH_MODULE_META[k],
      page: getRecordPage(k),
    }),
  )

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
    setCounts(c)
    setActivityData(grouped)
    setLoaded(true)
  }, [])

  return (
    <View className="health-page">
      <ScrollView className="health-scroll" scrollY>
        <View className="health-header">
          <Text className="health-title">健康记录</Text>
          <Text
            className="health-gear"
            onClick={() => Taro.navigateTo({ url: '/pages/settings/tracking/index' })}
          >
            ⚙️
          </Text>
        </View>

        <View className="health-cal-toggle" onClick={() => setCalVisible((v) => !v)}>
          <Text className="health-cal-toggle__text">{calVisible ? '收起日历' : '展开日历'}</Text>
          <Text className={`health-cal-toggle__arrow ${calVisible ? 'health-cal-toggle__arrow--up' : ''}`}>▼</Text>
        </View>

        {calVisible && (
          <View className="anim-fade-up">
            <Calendar
              year={calYear}
              month={calMonth}
              activityData={activityData}
              onMonthChange={(y, m) => {
                setCalYear(y)
                setCalMonth(m)
              }}
              onDayClick={(date) =>
                Taro.showModal({
                  title: date,
                  content: `${activityData.get(date)?.length || 0} 条记录`,
                  showCancel: false,
                })
              }
            />
          </View>
        )}

        <View className="cell-group anim-stagger">
          {!loaded
            ? Array.from({ length: 4 }).map((_, i) => (
                <View key={i} className="cell cell--loading">
                  <View className="cell__body">
                    <View className="skeleton-line" style={{ width: '120px' }} />
                  </View>
                </View>
              ))
            : modules.map((m) => (
                <View key={m.key} className="cell anim-fade-up" onClick={() => Taro.navigateTo({ url: m.page })}>
                  <View className="cell__body">
                    <View className="cell__title-row">
                      <Text className="cell__title">{m.label}</Text>
                      <Text className="cell__tag" data-active={counts[m.key] > 0}>
                        {counts[m.key] > 0 ? `今日 ${counts[m.key]} 次` : '未记录'}
                      </Text>
                    </View>
                    <Text className="cell__desc">{m.unit ? `记录${m.unit}` : '记录'}</Text>
                  </View>
                  <Text className="cell__arrow">›</Text>
                </View>
              ))}

          <View className="cell" onClick={() => Taro.navigateTo({ url: '/pages/form-list/index' })}>
            <View className="cell__body">
              <Text className="cell__title">健康量表</Text>
              <Text className="cell__desc">查看已发布的健康量表</Text>
            </View>
            <Text className="cell__arrow">›</Text>
          </View>

          <View className="cell" onClick={() => Taro.navigateTo({ url: '/pages/records/index' })}>
            <View className="cell__body">
              <Text className="cell__title">全部记录</Text>
              <Text className="cell__desc">按类型筛选历史数据</Text>
            </View>
            <Text className="cell__arrow">›</Text>
          </View>
        </View>
      </ScrollView>
      <TabBar current="health" />
    </View>
  )
}
