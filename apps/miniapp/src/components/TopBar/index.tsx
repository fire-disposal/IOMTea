import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo } from 'react'
import { CreditIcon } from '../CreditIcon'
import './index.scss'

interface TopBarProps {
  displayName: string
  credit: number
  animating?: boolean
}

const AVATAR_COLORS = [
  ['#6BA539', '#8EC15B'],
  ['#4A90D9', '#74B9FF'],
  ['#E67E22', '#F0A04B'],
  ['#9B59B6', '#BB8FCE'],
  ['#1ABC9C', '#48C9B0'],
]

export function TopBar({ displayName, credit, animating }: TopBarProps) {
  const avatarChar = displayName ? displayName[0] : '用'

  const gradient = useMemo(() => {
    const idx = (displayName || '用').charCodeAt(0) % AVATAR_COLORS.length
    return AVATAR_COLORS[idx]
  }, [displayName])

  return (
    <View className="top-bar">
      <View className="top-bar__main" onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
        <View className="top-bar__avatar" style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}>
          <Text className="top-bar__avatar-text">{avatarChar}</Text>
        </View>
        <View className="top-bar__info">
          <Text className="top-bar__name">{displayName}</Text>
        </View>
      </View>
      <View
        className={`top-bar__credit ${animating ? 'anim-balance-bump' : ''}`}
        onClick={() => Taro.navigateTo({ url: '/pages/credit/index' })}
      >
        <CreditIcon size={16} />
        <Text className="top-bar__credit-num">{credit}</Text>
      </View>
    </View>
  )
}
