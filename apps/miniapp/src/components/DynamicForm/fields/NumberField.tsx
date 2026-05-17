import { View, Text, Input } from '@tarojs/components'
import type { FormField } from '@iomtea/shared-types'

interface NumberFieldProps {
  field: FormField & { type: 'number' }
  value: number
  onChange: (v: number) => void
}

export function NumberField({ field, value, onChange }: NumberFieldProps) {
  return (
    <View className='dynamic-field'>
      <Text className='dynamic-field__label'>{field.label}</Text>
      <View className='dynamic-field__number'>
        <Input
          type='digit'
          className='dynamic-field__number-input'
          value={value != null ? String(value) : ''}
          onInput={e => {
            const v = parseFloat(e.detail.value)
            if (!isNaN(v)) onChange(v)
          }}
          placeholder='请输入'
        />
        {field.unit && <Text className='dynamic-field__number-unit'>{field.unit}</Text>}
      </View>
    </View>
  )
}
