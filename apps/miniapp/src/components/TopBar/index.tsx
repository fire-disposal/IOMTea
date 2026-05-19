import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { CreditIcon } from '../CreditIcon'
import './index.scss'

interface TopBarProps {
  displayName: string
  credit: number
  animating?: boolean
}

export function TopBar({ displayName, credit, animating }: TopBarProps) {
  const avatarChar = displayName ? displayName[0] : '用'

  return (
    <View className='top-bar'>
      <View className='top-bar__left' onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
        <View className='top-bar__avatar'>
          <Text className='top-bar__avatar-text'>{avatarChar}</Text>
        </View>
        <Text className='top-bar__name'>{displayName}</Text>
      </View>
      <View className={`top-bar__credit ${animating ? 'anim-balance-bump' : ''}`}>
        <CreditIcon size={18} />
        <Text className='top-bar__credit-num'>{credit}</Text>
      </View>
    </View>
  )
}
