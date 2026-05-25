import { View, Text } from '@tarojs/components'
import { Button } from '@nutui/nutui-react'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { trpc } from '../../utils/trpc'
import './index.scss'

export default function Login() {
  const [loading, setLoading] = useState(false)

  async function handleWechatLogin() {
    setLoading(true)
    try {
      const { code } = await Taro.login()
      const result = await trpc.auth.wechatLogin.mutate({ code })
      Taro.setStorageSync('token', result.accessToken)
      Taro.setStorageSync('refreshToken', result.refreshToken)
      if (result.displayName) Taro.setStorageSync('user_name', result.displayName)
      Taro.redirectTo({ url: '/pages/pin-overview/index' })
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '登录失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="login-page">
      <View className="login-hero anim-fade-up">
        <Text className="login-brand anim-pulse">IOMTea</Text>
        <Text className="login-desc">居家健康管理</Text>
      </View>

      <View className="login-actions anim-fade-up" style="animation-delay:200ms">
        <Button type="primary" size="large" block loading={loading} onClick={handleWechatLogin}>
          微信登录
        </Button>
        <Text className="login-hint">登录后同步健康数据</Text>
      </View>
    </View>
  )
}
