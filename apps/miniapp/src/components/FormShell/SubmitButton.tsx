import { View, Text } from '@tarojs/components'
import './SubmitButton.scss'

interface SubmitButtonProps {
  onClick: () => void
  loading?: boolean
  saved?: boolean
  label?: string
}

export function SubmitButton({ onClick, loading, saved, label = '保存' }: SubmitButtonProps) {
  return (
    <View
      className={`submit-btn ${loading ? 'submit-btn--loading' : ''} ${saved ? 'submit-btn--saved' : ''}`}
      onClick={loading || saved ? undefined : onClick}
    >
      {loading ? <Text>保存中...</Text> : saved ? <Text>✓ 已保存</Text> : <Text>{label}</Text>}
    </View>
  )
}
