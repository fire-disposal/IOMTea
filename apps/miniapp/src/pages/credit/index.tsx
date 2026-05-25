// @ts-nocheck
import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { CreditIcon } from '../../components/CreditIcon'
import { HEALTH_MODULE_META, type HealthModuleKey } from '../../constants/modules'
import { trpc } from '../../utils/trpc'
import './index.scss'

interface Transaction {
  id: string
  amount: number
  moduleKey: string | null
  streakDay: number | null
  type: string
  source: string
  createdAt: string
}

export default function CreditPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    Promise.all([
      trpc.credit.balance.query(),
      trpc.credit.transactions.query({ page: 1, pageSize: 50 }),
    ])
      .then(([bal, txns]) => {
        if (bal) setBalance(bal.balance)
        if (txns) setTransactions(txns)
      })
      .catch(() => {})
  }, [])

  return (
    <View className="credit-page">
      <View className="credit-page__header">
        <Text className="credit-page__back" onClick={() => Taro.navigateBack()}>
          �?返回
        </Text>
        <Text className="credit-page__title">积分明细</Text>
        <View style={{ width: 48 }} />
      </View>

      <View className="credit-page__balance">
        <CreditIcon size={28} />
        <Text className="credit-page__balance-num">{balance}</Text>
      </View>

      <ScrollView className="credit-page__list" scrollY>
        {transactions.map((tx) => {
          const meta = tx.moduleKey ? HEALTH_MODULE_META[tx.moduleKey as HealthModuleKey] : null
          return (
            <View key={tx.id} className="credit-tx">
              <View className="credit-tx__left">
                <Text className="credit-tx__icon">{meta?.icon ?? '🎁'}</Text>
                <View className="credit-tx__info">
                  <Text className="credit-tx__label">{meta?.label ?? tx.moduleKey ?? '系统'}</Text>
                  <Text className="credit-tx__date">
                    {tx.createdAt?.slice(0, 10)}
                    {tx.streakDay ? ` · 连击 Day ${tx.streakDay}` : ''}
                  </Text>
                </View>
              </View>
              <Text className="credit-tx__amount credit-tx__amount--earn">+{tx.amount}</Text>
            </View>
          )
        })}

        {transactions.length === 0 && (
          <View className="credit-page__empty">
            <Text>暂无积分记录</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
