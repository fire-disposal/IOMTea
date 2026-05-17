import { View, Text, Button, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { TabBar } from '../../components/TabBar'
import { getLocalRecords, getUnsyncedRecords } from '../../utils/storage'
import { syncUnsyncedRecords } from '../../utils/sync'
import { trpc } from '../../utils/trpc'
import './index.scss'

const TYPE_LABELS: Record<string, string> = {
  blood_glucose: '血糖', blood_pressure: '血压', weight: '体重',
  heart_rate: '心率', temperature: '体温', spo2: '血氧',
  medication: '用药', period: '生理期',
}

interface PinInfo {
  pin: string
  nickname: string | null
  label: string | null
  lastSeenAt: string | null
  createdAt?: string | null
  thingId?: string | null
  userId?: string
}

export default function ProfilePage() {
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({})
  const [unsyncedCount, setUnsyncedCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [pins, setPins] = useState<PinInfo[]>([])
  const [pinsLoading, setPinsLoading] = useState(true)
  const [editingPinId, setEditingPinId] = useState<string | null>(null)
  const [nicknameInput, setNicknameInput] = useState('')

  const loadStats = () => {
    const all = getLocalRecords()
    const counts: Record<string, number> = {}
    let unsynced = 0
    for (const r of all) {
      counts[r.type] = (counts[r.type] || 0) + 1
      if (!r.synced) unsynced++
    }
    setRecordCounts(counts)
    setUnsyncedCount(unsynced)
  }

  useEffect(() => { loadStats() }, [])

  useEffect(() => {
    trpc.user.me.query().then(me => {
      if (me?.id) trpc.pin.list.query({ userId: me.id }).then(data => {
        setPins(data)
        setPinsLoading(false)
      }).catch(() => setPinsLoading(false))
    }).catch(() => setPinsLoading(false))
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    await syncUnsyncedRecords()
    loadStats()
    setSyncing(false)
    Taro.showToast({ title: '同步完成', icon: 'success' })
  }

  const maskCode = (code: string) => {
    if (code.length <= 4) return code
    return code.slice(0, 2) + '****' + code.slice(-2)
  }

  const copyCode = (code: string) => {
    Taro.setClipboardData({ data: code })
    Taro.showToast({ title: '已复制', icon: 'success' })
  }

  const updateNickname = async (pinId: string) => {
    if (!nicknameInput.trim()) return
    try {
      await trpc.pin.update.mutate({ pin: pinId, nickname: nicknameInput.trim() })
      setPins(prev => prev.map(p => p.pin === pinId ? { ...p, nickname: nicknameInput.trim() } : p))
      setEditingPinId(null)
      setNicknameInput('')
      Taro.showToast({ title: '已更新', icon: 'success' })
    } catch {
      Taro.showToast({ title: '更新失败', icon: 'error' })
    }
  }

  return (
    <View className='profile-page animation-fade'>
      <View className='profile-page__header'>
        <View className='profile-page__avatar'>
          <Text className='profile-page__avatar-text'>我</Text>
        </View>
        <Text className='profile-page__name'>用户</Text>
      </View>

      <View className='profile-page__section'>
        <Text className='profile-page__section-title'>记录统计</Text>
        <View className='profile-page__stats'>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <View key={key} className='profile-stat-item'>
              <Text className='profile-stat-item__num'>{recordCounts[key] || 0}</Text>
              <Text className='profile-stat-item__label'>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='profile-page__menu'>
        <View className='profile-menu-item' onClick={() => Taro.navigateTo({ url: '/pages/export/index' })}>
          <Text className='profile-menu-item__icon'>📤</Text>
          <Text className='profile-menu-item__label'>导出数据</Text>
          <Text className='profile-menu-item__arrow'>›</Text>
        </View>
        <View className='profile-menu-item' onClick={() => Taro.navigateTo({ url: '/pages/settings/goals/index' })}>
          <Text className='profile-menu-item__icon'>🎯</Text>
          <Text className='profile-menu-item__label'>健康目标</Text>
          <Text className='profile-menu-item__arrow'>›</Text>
        </View>
        <View className='profile-menu-item' onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
          <Text className='profile-menu-item__icon'>⚙️</Text>
          <Text className='profile-menu-item__label'>系统设置</Text>
          <Text className='profile-menu-item__arrow'>›</Text>
        </View>
        <View className='profile-menu-item' onClick={() => Taro.navigateTo({ url: '/pages/devices/index' })}>
          <Text className='profile-menu-item__icon'>📱</Text>
          <Text className='profile-menu-item__label'>设备管理</Text>
          <Text className='profile-menu-item__arrow'>›</Text>
        </View>
      </View>

      {pinsLoading ? (
        <View className='profile-page__section'>
          <Text className='profile-page__section-title'>PIN 管理</Text>
          <View className='profile-pins-skeleton'>
            {Array.from({ length: 2 }).map((_, i) => (
              <View key={i} className='pin-skeleton' />
            ))}
          </View>
        </View>
      ) : pins.length > 0 && (
        <View className='profile-page__section'>
          <Text className='profile-page__section-title'>PIN 管理</Text>
          {pins.map(pin => (
            <View key={pin.pin} className='pin-item'>
              <View className='pin-item__info'>
                <Text className='pin-item__code'>{maskCode(pin.pin)}</Text>
                {editingPinId === pin.pin ? (
                  <Input className='pin-item__nickname-input'
                    value={nicknameInput}
                    onInput={e => setNicknameInput(e.detail.value)}
                    onBlur={() => updateNickname(pin.pin)}
                    confirmType='done'
                    onConfirm={() => updateNickname(pin.pin)} />
                ) : (
                  <Text className='pin-item__nickname' onClick={() => { setEditingPinId(pin.pin); setNicknameInput(pin.nickname || '') }}>{pin.nickname || '点击设置昵称'}</Text>
                )}
                <Text className='pin-item__label'>{pin.label}</Text>
                {pin.lastSeenAt && <Text className='pin-item__last-seen'>最近: {pin.lastSeenAt.slice(0, 10)}</Text>}
              </View>
              <View className='pin-item__actions'>
                <Text className='pin-item__copy' onClick={() => copyCode(pin.pin)}>复制</Text>
                <Text className='pin-item__edit' onClick={() => { setEditingPinId(pin.pin); setNicknameInput(pin.nickname || '') }}>昵称</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View className='profile-page__sync'>
        <View className='profile-sync-info'>
          <Text className='profile-sync-info__label'>同步状态</Text>
          <Text className='profile-sync-info__count'>{unsyncedCount} 条待同步</Text>
        </View>
        <Button className='profile-sync-btn' onClick={handleSync} loading={syncing} disabled={syncing || unsyncedCount === 0}>
          立即同步
        </Button>
      </View>

      <TabBar current='profile' />
    </View>
  )
}
