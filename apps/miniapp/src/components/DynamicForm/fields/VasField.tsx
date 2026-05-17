import { View, Text, Slider } from '@tarojs/components'
import type { FormField } from '@iomtea/shared-types'

interface VasFieldProps {
  field: FormField & { type: 'vas' }
  value: number
  onChange: (v: number) => void
}

export function VasField({ field, value = 0, onChange }: VasFieldProps) {
  return (
    <View className='dynamic-field'>
      <Text className='dynamic-field__label'>{field.label}</Text>
      <View className='dynamic-field__vas'>
        <View className='dynamic-field__vas-labels'>
          <Text>{field.min_label ?? '0'}</Text>
          <Text className='dynamic-field__vas-value'>{value}</Text>
          <Text>{field.max_label ?? '100'}</Text>
        </View>
        <Slider
          min={0}
          max={100}
          step={1}
          value={value}
          onChanging={e => onChange(e.detail.value)}
          activeColor='#4a90d9'
          blockColor='#4a90d9'
        />
      </View>
    </View>
  )
}
