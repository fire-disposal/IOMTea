import { useState, useCallback } from 'react'
import { View, Text, Button } from '@tarojs/components'
import type { FormDefinition } from '@iomtea/shared-types'
import { buildResponseSchema } from '@iomtea/shared-types'
import { ChoiceField } from './fields/ChoiceField'
import { MultiField } from './fields/MultiField'
import { LikertField } from './fields/LikertField'
import { VasField } from './fields/VasField'
import { NumberField } from './fields/NumberField'
import { TextField } from './fields/TextField'
import './DynamicForm.scss'

interface DynamicFormRendererProps {
  form: FormDefinition
  onSubmit: (answers: Record<string, any>) => void
}

export function DynamicFormRenderer({ form, onSubmit }: DynamicFormRendererProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({})

  const setValue = useCallback((id: string, value: any) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }, [])

  const handleSubmit = () => {
    const schema = buildResponseSchema(form.fields)
    const result = schema.safeParse(answers)
    if (!result.success) {
      return
    }
    onSubmit(result.data)
  }

  const fieldComponents: Record<string, React.FC<any>> = {
    choice: ChoiceField,
    multi: MultiField,
    likert: LikertField,
    vas: VasField,
    number: NumberField,
    text: TextField,
  }

  return (
    <View className='dynamic-form'>
      <View className='dynamic-form__header'>
        <Text className='dynamic-form__title'>{form.title}</Text>
        {form.description && <Text className='dynamic-form__desc'>{form.description}</Text>}
      </View>
      <View className='dynamic-form__fields'>
        {form.fields.map(field => {
          const Component = fieldComponents[field.type]
          if (!Component) return null
          return (
            <Component
              key={field.id}
              field={field}
              value={answers[field.id]}
              onChange={(v: any) => setValue(field.id, v)}
            />
          )
        })}
      </View>
      <View className='dynamic-form__footer'>
        <Button className='dynamic-form__submit' onClick={handleSubmit}>
          提交
        </Button>
      </View>
    </View>
  )
}
