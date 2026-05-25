import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../../constants/storage-keys'
import './index.scss'

export default function Settings() {
  const handleLogout = () => {
    Taro.removeStorageSync(STORAGE_KEYS.TOKEN)
    Taro.reLaunch({ url: '/pages/login/index' })
  }

  return (
    <View className="settings-page">
      <View className="page-title">设置</View>
      <View className="settings-item" onClick={handleLogout}>
        <Text style={{ color: '#e03131' }}>退出登录</Text>
      </View>
    </View>
  )
}
