import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import './index.scss'

interface Patient { id: string; name: string; status: string }

export default function PatientSelect() {
  const [patients, setPatients] = useState<Patient[]>([])
  const currentId = Taro.getStorageSync('patient_id') || ''

  useEffect(() => {
    api.get<Patient[]>('/patients/mine').then(setPatients).catch(() => {})
  }, [])

  const select = (id: string) => {
    Taro.setStorageSync('patient_id', id)
    Taro.showToast({ title: '已切换', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 500)
  }

  return (
    <View className='page patient-select-page'>
      <Text className='title'>选择患者</Text>
      {patients.map((p) => (
        <View key={p.id} className={`patient-item ${p.id === currentId ? 'patient-item--active' : ''}`}
          onClick={() => select(p.id)}>
          <Text className='patient-name'>{p.name}</Text>
          <Text className='patient-status'>{p.status}</Text>
          {p.id === currentId && <Text className='current-badge'>当前</Text>}
        </View>
      ))}
      {patients.length === 0 && <Text className='empty'>暂无患者数据</Text>}
    </View>
  )
}
