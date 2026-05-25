import { Cell, CellGroup, Skeleton, Tag } from '@nutui/nutui-react'
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
          <Text>{calVisible ? '收起日历 �? : '展开日历 �?}</Text>
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

        {!loaded ? (
          <CellGroup className="anim-stagger">
            {Array.from({ length: 4 }).map((_, i) => (
              <Cell key={i} title={<Skeleton width="120px" height="20px" animated />} />
            ))}
          </CellGroup>
        ) : (
          <CellGroup className="anim-stagger">
            {modules.map((m) => (
              <Cell
                key={m.key}
                title={m.label}
                description={m.unit ? `记录${m.unit}` : '记录'}
                extra={
                  <Tag type={counts[m.key] > 0 ? 'primary' : 'default'}>
                    {counts[m.key] > 0 ? `今日 ${counts[m.key]} 次` : '未记�?}
                  </Tag>
                }
                onClick={() => Taro.navigateTo({ url: m.page })}
              />
            ))}
            <Cell
              title="全部记录"
              description="按类型筛选历史数�?
              extra={<Text style={{ color: '#999', fontSize: '12px' }}>�?/Text>}
              onClick={() => Taro.navigateTo({ url: '/pages/records/index' })}
            />
          </CellGroup>
        )}
      </ScrollView>
      <TabBar current="health" />
    </View>
  )
}
