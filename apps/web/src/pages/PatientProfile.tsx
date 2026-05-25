import { Container, Title, Paper, TextInput, Button, Group, Text, SimpleGrid } from '@mantine/core'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface Patient { id: string; name: string; gender: string | null; birthDate: string | null; heightCm: number | null; weightKg: number | null; bloodType: string | null; phone: string | null; address: string | null; status: string }

export function PatientProfile({ patientId }: { patientId: string }) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    http.get('/patients/' + patientId).then((r) => setPatient(r.data as Patient))
  }, [patientId])

  if (!patient) return <Text>Loading...</Text>

  const update = (field: string, value: string) => setPatient((p) => p ? { ...p, [field]: value } : p)

  const save = async () => {
    setSaving(true)
    await http.patch('/patients/' + patientId, {
      name: patient.name, phone: patient.phone, address: patient.address,
      heightCm: patient.heightCm, weightKg: patient.weightKg,
    } as any)
    setSaving(false)
  }

  return (
    <Container py="md">
      <Title order={3} mb="md">患者信息</Title>
      <SimpleGrid cols={2}>
        <TextInput label="姓名" value={patient.name} onChange={(e) => update('name', e.currentTarget.value)} />
        <TextInput label="性别" value={patient.gender ?? ''} onChange={(e) => update('gender', e.currentTarget.value)} />
        <TextInput label="出生日期" value={patient.birthDate ?? ''} onChange={(e) => update('birthDate', e.currentTarget.value)} />
        <TextInput label="身高(cm)" type="number" value={patient.heightCm?.toString() ?? ''} onChange={(e) => update('heightCm', e.currentTarget.value)} />
        <TextInput label="体重(kg)" type="number" value={patient.weightKg?.toString() ?? ''} onChange={(e) => update('weightKg', e.currentTarget.value)} />
        <TextInput label="血型" value={patient.bloodType ?? ''} onChange={(e) => update('bloodType', e.currentTarget.value)} />
        <TextInput label="电话" value={patient.phone ?? ''} onChange={(e) => update('phone', e.currentTarget.value)} />
        <TextInput label="地址" value={patient.address ?? ''} onChange={(e) => update('address', e.currentTarget.value)} />
      </SimpleGrid>
      <Group mt="md"><Button loading={saving} onClick={save}>保存</Button></Group>
    </Container>
  )
}
