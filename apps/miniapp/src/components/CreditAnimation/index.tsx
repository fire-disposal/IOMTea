import { View, Text } from '@tarojs/components'
import './index.scss'

interface CreditAnimationProps {
  visible: boolean
  amount: number
  x?: number
  y?: number
}

export function CreditAnimation({ visible, amount, x, y }: CreditAnimationProps) {
  if (!visible) return null

  return (
    <View className="credit-anim" style={{ left: x, top: y }}>
      <Text className="credit-anim__text anim-credit-float">+{amount}</Text>
    </View>
  )
}
