import { View, Text } from '@tarojs/components'
import type { FormField } from '@iomtea/shared-types'

interface LikertFieldProps {
  field: FormField & { type: 'likert' }
  value: number
  onChange: (v: number) => void
}

export function LikertField({ field, value, onChange }: LikertFieldProps) {
  return (
    <View className='dynamic-field'>
      <Text className='dynamic-field__label'>{field.label}</Text>
      <View className='dynamic-field__likert'>
        {field.labels.map((label, i) => (
          <View
            key={i}
            className={`dynamic-field__likert-item ${value === i ? 'dynamic-field__likert-item--active' : ''}`}
            onClick={() => onChange(i)}
          >
            <Text className='dynamic-field__likert-label'>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
