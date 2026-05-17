import { View, Text } from '@tarojs/components'
import type { FormField } from '@iomtea/shared-types'

interface MultiFieldProps {
  field: FormField & { type: 'multi' }
  value: string[]
  onChange: (v: string[]) => void
}

export function MultiField({ field, value = [], onChange }: MultiFieldProps) {
  const toggle = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter(v => v !== optValue))
    } else {
      onChange([...value, optValue])
    }
  }

  return (
    <View className='dynamic-field'>
      <Text className='dynamic-field__label'>{field.label}</Text>
      <View className='dynamic-field__options'>
        {field.options.map(opt => (
          <View
            key={opt.value}
            className={`dynamic-field__option ${value.includes(opt.value) ? 'dynamic-field__option--active' : ''}`}
            onClick={() => toggle(opt.value)}
          >
            <Text>{opt.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
