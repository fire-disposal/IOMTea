import { View, Text } from '@tarojs/components'
import { TabBar } from '../../components/TabBar/TabBar'
import './index.scss'

export default function MessagesPage() {
  return (
    <View className='messages-page'>
      <Text className='messages-page__title'>消息</Text>
      <View className='messages-page__empty'>
        <Text>暂无消息</Text>
      </View>
      <TabBar current='messages' />
    </View>
  )
}
