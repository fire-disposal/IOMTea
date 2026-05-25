// @ts-nocheck
import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { trpc } from '../../utils/trpc'
import './index.scss'

interface PinItem {
  pin: string
  nickname: string | null
  label: string | null
}

export default function PinOverview() {
  const [pins, setPins] = useState<PinItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const me = await trpc.user.me.query()
        if (!me) {
          Taro.redirectTo({ url: '/pages/login/index' })
          return
        }

        let userPins = await trpc.pin.getByUser.query({ userId: me.id })

        if (!userPins || userPins.length === 0) {
          const newPin = await trpc.pin.create.mutate({
            userId: me.id,
            label: '默认设备',
            nickname: '我的设备',
          })
          userPins = [newPin]
        }

        setPins(userPins)
      } catch {
        Taro.showToast({ title: '加载失败', icon: 'none' })
        Taro.redirectTo({ url: '/pages/login/index' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const copyPin = (pin: string) => {
    Taro.setClipboardData({ data: pin })
    Taro.showToast({ title: '已复�?PIN: ' + pin, icon: 'success' })
  }

  return (
    <View className="pin-page">
      <Text className="pin-page__title">设备连接</Text>
      <Text className="pin-page__subtitle">在传感设备上输入 PIN 码以连接数据</Text>

      {loading && <View className="pin-page__skeleton" />}

      {pins.map((p) => (
        <View key={p.pin} className="pin-card">
          <Text className="pin-card__code">{p.pin}</Text>
          {p.nickname && <Text className="pin-card__nickname">{p.nickname}</Text>}
          {p.label && <Text className="pin-card__label">{p.label}</Text>}
          <View className="pin-card__actions">
            <Button className="pin-card__copy" onClick={() => copyPin(p.pin)}>
              复制 PIN
            </Button>
          </View>
        </View>
      ))}

      <View className="pin-page__nav">
        <Button onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>进入首页</Button>
      </View>
    </View>
  )
}
