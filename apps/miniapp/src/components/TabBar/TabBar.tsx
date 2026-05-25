import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './TabBar.scss'

const TABS = [
  { key: 'index', path: '/pages/index/index', label: '首页', icon: '🏠' },
  { key: 'health', path: '/pages/health/index', label: '健康', icon: '📊' },
  { key: 'messages', path: '/pages/messages/index', label: '消息', icon: '⚠️' },
  { key: 'profile', path: '/pages/profile/index', label: '我的', icon: '👤' },
]

interface TabBarProps {
  current: string
}

export function TabBar({ current }: TabBarProps) {
  return (
    <View className="tab-bar">
      {TABS.map((tab) => (
        <View
          key={tab.key}
          className={`tab-bar__item ${current === tab.key ? 'tab-bar__item--active' : ''}`}
          onClick={() => Taro.switchTab({ url: tab.path })}
        >
          <Text className="tab-bar__icon">{tab.icon}</Text>
          <Text className="tab-bar__label">{tab.label}</Text>
        </View>
      ))}
    </View>
  )
}
