import { Text } from '@tarojs/components'

interface CreditIconProps {
  size?: number
  style?: React.CSSProperties
}

export function CreditIcon({ size = 20, style }: CreditIconProps) {
  return (
    <Text
      style={{
        fontSize: size,
        lineHeight: `${size}px`,
        display: 'inline-block',
        ...style,
      }}
    >
      🪙
    </Text>
  )
}
