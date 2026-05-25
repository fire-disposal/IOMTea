import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

interface ChecklistCardProps {
  moduleKey: string
  label: string
  icon: string
  status: 'pending' | 'done' | 'skipped'
  recordPage: string
  earnedCredits?: number
  animDone?: boolean
  animCredit?: boolean
}

export function ChecklistCard({
  label,
  icon,
  status,
  recordPage,
  earnedCredits,
  animDone,
  animCredit,
}: ChecklistCardProps) {
  const handleTap = () => {
    if (status === 'pending') {
      Taro.navigateTo({ url: recordPage })
    }
  }

  return (
    <View
      className={`checklist-card checklist-card--${status} ${animDone ? 'anim-card-done' : ''}`}
      onClick={handleTap}
    >
      <View className="checklist-card__accent" />
      <View className="checklist-card__body">
        <View className="checklist-card__icon-wrap">
          <Text className="checklist-card__icon">{icon}</Text>
        </View>
        <View className="checklist-card__info">
          <Text className="checklist-card__label">{label}</Text>
          {status === 'pending' && <Text className="checklist-card__hint">今日尚未记录</Text>}
        </View>
        <View className="checklist-card__status">
          {status === 'done' && <Text className="checklist-card__check">✓</Text>}
          {status === 'pending' && <View className="checklist-card__circle" />}
          {status === 'skipped' && <Text className="checklist-card__skip">—</Text>}
          {earnedCredits != null && animCredit && (
            <Text className="checklist-card__credit anim-credit-float">+{earnedCredits}</Text>
          )}
        </View>
      </View>
    </View>
  )
}
