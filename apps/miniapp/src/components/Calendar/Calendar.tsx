import { View, Text } from '@tarojs/components'
import { useState, useMemo } from 'react'
import './Calendar.scss'

interface CalendarProps {
  year: number
  month: number
  activityData: Map<string, string[]>
  onDayClick?: (date: string) => void
  onMonthChange?: (year: number, month: number) => void
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function Calendar({ year, month, activityData, onDayClick, onMonthChange }: CalendarProps) {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date()

  const days = useMemo(() => {
    const result: { day: number; date: string; isToday: boolean; records: string[] }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      result.push({
        day: d,
        date: dateStr,
        isToday:
          dateStr ===
          `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
        records: activityData.get(dateStr) || [],
      })
    }
    return result
  }, [year, month, activityData])

  const prevMonth = () => {
    const m = month === 1 ? 12 : month - 1
    const y = month === 1 ? year - 1 : year
    onMonthChange?.(y, m)
  }
  const nextMonth = () => {
    const m = month === 12 ? 1 : month + 1
    const y = month === 12 ? year + 1 : year
    onMonthChange?.(y, m)
  }

  return (
    <View className="calendar">
      <View className="calendar__header">
        <Text className="calendar__nav" onClick={prevMonth}>
          ◀
        </Text>
        <Text className="calendar__title">
          {year}年{month}月
        </Text>
        <Text className="calendar__nav" onClick={nextMonth}>
          ▶
        </Text>
      </View>
      <View className="calendar__weekdays">
        {WEEKDAYS.map((w) => (
          <Text key={w} className="calendar__weekday">
            {w}
          </Text>
        ))}
      </View>
      <View className="calendar__grid">
        {Array.from({ length: firstDay }).map((_, i) => (
          <View key={`empty-${i}`} className="calendar__day calendar__day--empty" />
        ))}
        {days.map((d) => (
          <View
            key={d.date}
            className={`calendar__day ${d.isToday ? 'calendar__day--today' : ''}`}
            onClick={() => onDayClick?.(d.date)}
          >
            <Text className="calendar__day-num">{d.day}</Text>
            {d.records.length > 0 && (
              <View className="calendar__dots">
                {d.records.slice(0, 3).map((r, i) => (
                  <View key={i} className="calendar__dot" />
                ))}
                {d.records.length > 3 && (
                  <Text className="calendar__dot-more">+{d.records.length - 3}</Text>
                )}
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  )
}
