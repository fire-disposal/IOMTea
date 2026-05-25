import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import './index.scss'

export default function DataView() {
  const [patients, setPatients] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [latest, setLatest] = useState<any[]>([])

  useEffect(() => { api.get<any[]>('/patients').then(setPatients).catch(() => {}) }, [])

  const selectPatient = (id: string) => {
    setSelected(id)
    api.get<any[]>('/data/latest', { patientId: id }).then(setLatest).catch(() => {})
  }

  return (
    <View className="data-page">
      <View className="page-title">数据查看</View>
      {!selected ? patients.map((p: any) => (
        <View key={p.id} className="data-patient" onClick={() => selectPatient(p.id)}>
          <Text>{p.name}</Text>
        </View>
      )) : (
        <View>
          <View onClick={() => setSelected('')}><Text>← 返回</Text></View>
          {latest.map((m: any) => (
            <View key={m.metric} className="data-item">
              <Text>{m.metric}: {String(m.value ?? '-')} {m.unit}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
