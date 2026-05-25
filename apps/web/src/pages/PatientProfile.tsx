import {
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface P {
  id: string
  name: string
  gender: string | null
  birthDate: string | null
  heightCm: number | null
  weightKg: number | null
  bloodType: string | null
  phone: string | null
  address: string | null
}

function parseId() {
  return window.location.pathname.split('/patients/')[1]?.split('/')[0] || ''
}

export function PatientProfile() {
  const patientId = parseId()
  const [patient, setPatient] = useState<P | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    http.get('/patients/' + patientId).then((r) => setPatient(r.data as P))
  }, [patientId])

  if (!patient)
    return (
      <Container py="md">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={24} mb="sm" />
        ))}
      </Container>
    )

  const update = (f: string, v: string) => setPatient((p) => (p ? { ...p, [f]: v } : p))
  const save = () => {
    setSaving(true)
    http
      .patch('/patients/' + patientId, {
        name: patient.name,
        phone: patient.phone,
        address: patient.address,
        heightCm: patient.heightCm,
        weightKg: patient.weightKg,
      } as any)
      .finally(() => setSaving(false))
  }

  return (
    <Container py="md">
      <Title order={3} mb="md">
        患者档案
      </Title>
      <SimpleGrid cols={2}>
        <TextInput
          label="姓名"
          value={patient.name}
          onChange={(e) => update('name', e.currentTarget.value)}
        />
        <TextInput
          label="性别"
          value={patient.gender ?? ''}
          onChange={(e) => update('gender', e.currentTarget.value)}
        />
        <TextInput
          label="出生日期"
          value={patient.birthDate ?? ''}
          onChange={(e) => update('birthDate', e.currentTarget.value)}
        />
        <TextInput
          label="身高(cm)"
          value={patient.heightCm?.toString() ?? ''}
          onChange={(e) => update('heightCm', e.currentTarget.value)}
        />
        <TextInput
          label="体重(kg)"
          value={patient.weightKg?.toString() ?? ''}
          onChange={(e) => update('weightKg', e.currentTarget.value)}
        />
        <TextInput
          label="血型"
          value={patient.bloodType ?? ''}
          onChange={(e) => update('bloodType', e.currentTarget.value)}
        />
        <TextInput
          label="电话"
          value={patient.phone ?? ''}
          onChange={(e) => update('phone', e.currentTarget.value)}
        />
        <TextInput
          label="地址"
          value={patient.address ?? ''}
          onChange={(e) => update('address', e.currentTarget.value)}
        />
      </SimpleGrid>
      <Group mt="md">
        <Button loading={saving} onClick={save}>
          保存
        </Button>
      </Group>
    </Container>
  )
}
