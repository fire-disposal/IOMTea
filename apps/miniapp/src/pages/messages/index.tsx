import { View, Text } from '@tarojs/components'
import { TabBar } from '../../components/TabBar/TabBar'
import './index.scss'

export default function MessagesPage() {
  return (
    <View className='messages-page'>
      <Text className='messages-page__title'>消息</Text>
      <View className='messages-page__empty'>
        <View className='messages-page__empty-icon'>
          <Text className='messages-page__empty-icon-text'>✉</Text>
        </View>
        <Text className='messages-page__empty-title'>暂无消息</Text>
        <Text className='messages-page__empty-hint'>健康提醒和通知将显示在这里</Text>
      </View>
      <TabBar current='messages' />
    </View>
  )
}
