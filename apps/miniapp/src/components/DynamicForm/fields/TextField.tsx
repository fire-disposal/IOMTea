import { View, Text, Textarea } from '@tarojs/components'
import type { FormField } from '@iomtea/shared-types'

interface TextFieldProps {
  field: FormField & { type: 'text' }
  value: string
  onChange: (v: string) => void
}

export function TextField({ field, value = '', onChange }: TextFieldProps) {
  return (
    <View className='dynamic-field'>
      <Text className='dynamic-field__label'>{field.label}</Text>
      <Textarea
        className='dynamic-field__textarea'
        value={value}
        onInput={e => onChange(e.detail.value)}
        placeholder={field.placeholder}
      />
    </View>
  )
}
