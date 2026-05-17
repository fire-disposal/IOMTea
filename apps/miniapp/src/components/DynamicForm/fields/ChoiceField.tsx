import { View, Text } from '@tarojs/components'
import type { FormField } from '@iomtea/shared-types'

interface ChoiceFieldProps {
  field: FormField & { type: 'choice' }
  value: string
  onChange: (v: string) => void
}

export function ChoiceField({ field, value, onChange }: ChoiceFieldProps) {
  return (
    <View className='dynamic-field'>
      <Text className='dynamic-field__label'>{field.label}</Text>
      <View className='dynamic-field__options'>
        {field.options.map(opt => (
          <View
            key={opt.value}
            className={`dynamic-field__option ${value === opt.value ? 'dynamic-field__option--active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            <Text>{opt.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
