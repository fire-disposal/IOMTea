import { View, Text } from '@tarojs/components'
import { MiniTrend } from './MiniTrend'
import { SubmitButton } from './SubmitButton'
import './FormShell.scss'

interface FormShellProps {
  title: string
  unit: string
  children: React.ReactNode
  onSave: () => void
  saving?: boolean
  saved?: boolean
  recentData?: { value: number; date: string }[]
}

export function FormShell({ title, unit, children, onSave, saving, saved, recentData }: FormShellProps) {
  return (
    <View className='form-shell animation-fade'>
      <View className='form-shell__header'>
        <Text className='form-shell__title'>{title}</Text>
        <Text className='form-shell__unit'>{unit}</Text>
      </View>
      <View className='form-shell__body'>
        {children}
      </View>
      {recentData && recentData.length > 0 && (
        <View className='form-shell__trend'>
          <MiniTrend data={recentData} />
        </View>
      )}
      <View className='form-shell__footer'>
        <SubmitButton onClick={onSave} loading={saving} saved={saved} />
      </View>
    </View>
  )
}
