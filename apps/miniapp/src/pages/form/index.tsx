import {
  Checkbox,
  CheckboxGroup,
  Input,
  Radio,
  RadioGroup,
  Slider,
  Text,
  Textarea,
  View,
} from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { STORAGE_KEYS } from '../../constants/storage-keys'
import { api } from '../../utils/api'
import './index.scss'

interface FormField {
  id: string
  type: string
  label: string
  required: boolean
  options?: { value: string; label: string }[]
  labels?: string[]
  min_label?: string
  max_label?: string
  min?: number
  max?: number
  unit?: string
  placeholder?: string
  rows?: number
}

interface FormDef {
  code: string
  title: string
  description?: string
  fields: FormField[]
}

export default function FormPage() {
  const router = useRouter()
  const code = router.params.code || ''
  const [form, setForm] = useState<FormDef | null>(null)
  const [responses, setResponses] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const patientId = Taro.getStorageSync(STORAGE_KEYS.PATIENT_ID) || ''

  useEffect(() => {
    if (!code) return
    api
      .get<FormDef>(`/forms/${code}`)
      .then(setForm)
      .catch(() => {})
  }, [code])

  const setField = (fieldId: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }))
  }

  const submit = async () => {
    if (!patientId) {
      Taro.showToast({ title: '未绑定患者', icon: 'none' })
      return
    }
    for (const f of form?.fields || []) {
      if (f.required && responses[f.id] === undefined) {
        Taro.showToast({ title: `请填写: ${f.label}`, icon: 'none' })
        return
      }
    }
    setSubmitting(true)
    try {
      await api.post(`/forms/${code}/respond`, { patientId, responses })
      Taro.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch {
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!form)
    return (
      <View className="page">
        <View className="card-skeleton anim-pulse" style={{ height: 40, margin: 16, borderRadius: 8, background: 'var(--text-secondary)', opacity: 0.12 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} className="card-skeleton anim-pulse" style={{ height: 60, margin: '0 16px 12px', borderRadius: 8, background: 'var(--text-secondary)', opacity: 0.1 }} />
        ))}
      </View>
    )

  return (
    <View className="page form-page">
      <Text className="form-title">{form.title}</Text>
      {form.description && <Text className="form-desc">{form.description}</Text>}

      {form.fields.map((f) => (
        <View key={f.id} className="form-field">
          <Text className="form-field-label">
            {f.label}
            {f.required && <Text className="required"> *</Text>}
          </Text>

          {f.type === 'choice' && f.options && (
            <RadioGroup onChange={(e) => setField(f.id, e.detail.value)}>
              {f.options.map((o) => (
                <Radio key={o.value} value={o.value} checked={responses[f.id] === o.value}>
                  <Text>{o.label}</Text>
                </Radio>
              ))}
            </RadioGroup>
          )}

          {f.type === 'multi' && f.options && (
            <CheckboxGroup onChange={(e) => setField(f.id, e.detail.value)}>
              {f.options.map((o) => (
                <Checkbox
                  key={o.value}
                  value={o.value}
                  checked={((responses[f.id] as string[]) || []).includes(o.value)}
                >
                  <Text>{o.label}</Text>
                </Checkbox>
              ))}
            </CheckboxGroup>
          )}

          {f.type === 'likert' && f.labels && (
            <View className="likert-scale">
              <RadioGroup onChange={(e) => setField(f.id, Number(e.detail.value))}>
                {f.labels.map((label, i) => (
                  <Radio key={i} value={String(i)} checked={responses[f.id] === i}>
                    <Text>{label}</Text>
                  </Radio>
                ))}
              </RadioGroup>
            </View>
          )}

          {f.type === 'vas' && (
            <View className="vas-slider">
              {f.min_label && <Text className="vas-label">{f.min_label}</Text>}
              <Slider
                min={0}
                max={100}
                step={1}
                value={Number(responses[f.id]) || 50}
                onChange={(e) => setField(f.id, e.detail.value)}
                showValue
              />
              {f.max_label && <Text className="vas-label">{f.max_label}</Text>}
            </View>
          )}

          {f.type === 'number' && (
            <Input
              type="number"
              placeholder={`${f.min ?? ''}${f.min && f.max ? ' - ' : ''}${f.max ?? ''}`}
              value={String(responses[f.id] || '')}
              onInput={(e) => setField(f.id, Number(e.detail.value))}
            />
          )}

          {f.type === 'text' && (
            <Textarea
              placeholder={f.placeholder || ''}
              value={String(responses[f.id] || '')}
              onInput={(e) => setField(f.id, e.detail.value)}
              maxlength={2000}
            />
          )}
        </View>
      ))}

      <View className="form-submit">
        <View
          className={`submit-btn ${submitting ? 'submit-btn--loading' : ''}`}
          onClick={submitting ? undefined : submit}
        >
          <Text>{submitting ? '提交中...' : '提交'}</Text>
        </View>
      </View>
    </View>
  )
}
