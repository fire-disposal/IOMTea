import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import './index.scss'

export default function Credit() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [credit, setCredit] = useState(0)

  useEffect(() => {
    api.get<{ credit: number }>('/users/me').then((r) => setCredit(r.credit ?? 0)).catch(() => {})
    api.get<any[]>('/credits/transactions', { pageSize: '100' }).then(setTransactions).catch(() => {})
  }, [])

  return (
    <View className="credit-page">
      <View className="page-title">积分余额: {credit}</View>
      {transactions.map((t: any, i: number) => (
        <View key={t.id || i} className="credit-item">
          <Text>+{t.amount} · {t.description || t.source}</Text>
        </View>
      ))}
    </View>
  )
}
