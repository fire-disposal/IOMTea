import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { trpc } from '../../utils/trpc'

export default function Login() {
  const [loading, setLoading] = useState(false)

  async function handleWechatLogin() {
    setLoading(true)
    try {
      const { code } = await Taro.login()
      const result = await trpc.auth.wechatLogin.mutate({ code })
      Taro.setStorageSync('token', result.accessToken)
      Taro.setStorageSync('refreshToken', result.refreshToken)
      Taro.redirectTo({ url: '/pages/pin-overview/index' })
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '登录失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDemoLogin() {
    setLoading(true)
    try {
      const result = await trpc.auth.login.mutate({
        username: 'demo',
        password: 'demo123',
      })
      Taro.setStorageSync('token', result.accessToken)
      Taro.setStorageSync('refreshToken', result.refreshToken)
      Taro.redirectTo({ url: '/pages/pin-overview/index' })
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '演示登录失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="login">
      <View className="logo">
        <Text className="logo-text">IOMTea</Text>
        <Text className="logo-sub">居家健康管理</Text>
      </View>

      <Button className="wechat-btn" type="primary" loading={loading} onClick={handleWechatLogin}>
        微信一键登录
      </Button>

      <Text className="login-hint">首次登录将自动创建账号</Text>
      <Text className="demo-link" onClick={handleDemoLogin}>演示模式</Text>
    </View>
  )
}
