import { Button, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { api } from '../../utils/api'
import { STORAGE_KEYS } from '../../constants/storage-keys'
import './index.scss'

export default function Login() {
  const [loading, setLoading] = useState(false)

  const handleWechatLogin = async () => {
    setLoading(true)
    try {
      const res = await Taro.login()
      if (!res.code) throw new Error('wx.login failed')
      const data = await api.post<{ accessToken: string; refreshToken: string; user: { id: string; username: string; displayName: string | null } }>('/auth/wechat-login', { code: res.code })
      Taro.setStorageSync(STORAGE_KEYS.TOKEN, data.accessToken)
      Taro.setStorageSync(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken)
      Taro.setStorageSync(STORAGE_KEYS.USER_NAME, data.user.displayName || data.user.username)
      Taro.setStorageSync(STORAGE_KEYS.USER_ID, data.user.id)
      Taro.redirectTo({ url: '/pages/index/index' })
    } catch { Taro.showToast({ title: '登录失败', icon: 'none' }) }
    finally { setLoading(false) }
  }

  return (
    <View className="login-page">
      <View className="login-logo">IOMTea</View>
      <View className="login-desc">健康数据监护平台</View>
      <Button className="login-btn" loading={loading} onClick={handleWechatLogin}>微信一键登录</Button>
    </View>
  )
}
