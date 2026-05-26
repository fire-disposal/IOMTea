import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import './index.scss'

interface FormDef {
  code: string
  title: string
  description?: string
  fields: { length: number }
  status: string
}

export default function FormList() {
  const [forms, setForms] = useState<FormDef[]>([])

  useEffect(() => {
    api
      .get<FormDef[]>('/forms')
      .then((r) => setForms((r || []).filter((f) => f.status === 'published')))
      .catch(() => {})
  }, [])

  return (
    <View className="page form-list-page">
      <Text className="title">健康量表</Text>
      {forms.map((f) => (
        <View
          key={f.code}
          className="form-card"
          onClick={() => Taro.navigateTo({ url: `/pages/form/index?code=${f.code}` })}
        >
          <Text className="form-card-title">{f.title}</Text>
          {f.description && <Text className="form-card-desc">{f.description}</Text>}
          <Text className="form-card-meta">{f.fields?.length || 0} 个问题</Text>
        </View>
      ))}
      {forms.length === 0 && <Text className="empty">暂无可用量表</Text>}
    </View>
  )
}
