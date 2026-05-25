import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { TabBar } from '../../components/TabBar'
import { api } from '../../utils/api'
import { STORAGE_KEYS } from '../../constants/storage-keys'
import './index.scss'

export default function Profile() {
  const [credit, setCredit] = useState(0)
  const [user, setUser] = useState<{ displayName: string | null; username: string }>({ displayName: null, username: '' })
  const [recordCount, setRecordCount] = useState(0)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const me = await api.get<{ credit: number; displayName: string | null; username: string }>('/users/me')
      if (me) {
        setCredit(me.credit ?? 0)
        setUser({ displayName: me.displayName, username: me.username })
      }
    } catch { /* offline */ }

    // local record count
    const records = Taro.getStorageSync(STORAGE_KEYS.RECORDS) || []
    setRecordCount(records.length)
  }

  const handleSync = async () => {
    const records = Taro.getStorageSync(STORAGE_KEYS.RECORDS) || []
    const unsynced = records.filter((r: any) => !r.synced)
    if (unsynced.length === 0) {
      Taro.showToast({ title: '已全部同�?, icon: 'none' })
      return
    }
    try {
      await api.post('/ingest/batch', { events: unsynced })
      Taro.showToast({ title: `同步 ${unsynced.length} 条成功`, icon: 'none' })
    } catch (e: any) {
      Taro.showToast({ title: '同步失败', icon: 'none' })
    }
  }

  const handleLogout = () => {
    Taro.removeStorageSync(STORAGE_KEYS.TOKEN)
    Taro.reLaunch({ url: '/pages/login/index' })
  }

  return (
    <View className="profile-page">
      <View className="profile-header">
        <Text className="profile-name">{user.displayName || user.username}</Text>
      </View>
      <View className="profile-stats">
        <View className="profile-stat" onClick={() => Taro.navigateTo({ url: '/pages/credit/index' })}>
          <Text className="profile-stat__num">{credit}</Text>
          <Text className="profile-stat__label">积分</Text>
        </View>
        <View className="profile-stat">
          <Text className="profile-stat__num">{recordCount}</Text>
          <Text className="profile-stat__label">记录</Text>
        </View>
      </View>
      <View className="profile-menu">
        <View className="profile-menu__item" onClick={() => Taro.navigateTo({ url: '/pages/records/index' })}>
          <Text>历史记录</Text>
        </View>
        <View className="profile-menu__item" onClick={() => Taro.navigateTo({ url: '/pages/pin-overview/index' })}>
          <Text>PIN 管理</Text>
        </View>
        <View className="profile-menu__item" onClick={handleSync}>
          <Text>同步数据</Text>
        </View>
        <View className="profile-menu__item" onClick={handleLogout}>
          <Text style={{ color: '#e03131' }}>退出登�?/Text>
        </View>
      </View>
      <TabBar current="profile" />
    </View>
  )
}
