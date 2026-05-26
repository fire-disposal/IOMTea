import {
  Button,
  Container,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { useGet, usePatch } from '../api/hooks'
import { parsePatientId } from '../lib/path'
import { StateSkeleton } from '../components/StateComponents'

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

export function PatientProfile() {
  const pid = parsePatientId()
  const { data: p, isLoading, refetch } = useGet<P>(`/patients/${pid}`)
  const update = usePatch('/patients/:id')

  const [form, setForm] = useState<P | null>(null)

  useEffect(() => { if (p && !form) setForm({ ...p }) }, [p])

  if (isLoading || !p || !form)
    return <StateSkeleton lines={4} />

  const set = (field: keyof P, value: unknown) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev))

  const save = () =>
    update.mutate(
      {
        id: pid,
        name: form.name,
        gender: form.gender,
        birthDate: form.birthDate,
        heightCm: form.heightCm,
        weightKg: form.weightKg,
        bloodType: form.bloodType,
        phone: form.phone,
        address: form.address,
      } as any,
      {
        onSuccess: () => refetch(),
      },
    )

  return (
    <Container py="md">
      <Title order={3} mb="md">
        患者档案
      </Title>
      <SimpleGrid cols={2}>
        <TextInput
          label="姓名"
          value={form.name}
          onChange={(e) => set('name', e.currentTarget.value)}
        />
        <Select
          label="性别"
          data={[
            { value: 'male', label: '男' },
            { value: 'female', label: '女' },
            { value: 'other', label: '其他' },
          ]}
          value={form.gender ?? ''}
          onChange={(v) => set('gender', v)}
        />
        <TextInput
          label="出生日期"
          type="date"
          value={form.birthDate ?? ''}
          onChange={(e) => set('birthDate', e.currentTarget.value)}
        />
        <Select
          label="血型"
          data={['A', 'B', 'AB', 'O'].map((v) => ({ value: v, label: v }))}
          value={form.bloodType ?? ''}
          onChange={(v) => set('bloodType', v)}
        />
        <NumberInput
          label="身高 (cm)"
          value={form.heightCm ?? ''}
          onChange={(v) => set('heightCm', v)}
        />
        <NumberInput
          label="体重 (kg)"
          value={form.weightKg ?? ''}
          onChange={(v) => set('weightKg', v)}
        />
        <TextInput
          label="电话"
          value={form.phone ?? ''}
          onChange={(e) => set('phone', e.currentTarget.value)}
        />
        <Textarea
          label="地址"
          value={form.address ?? ''}
          onChange={(e) => set('address', e.currentTarget.value)}
        />
      </SimpleGrid>
      <Group mt="md">
        <Button loading={update.isPending} onClick={save}>
          保存
        </Button>
      </Group>
    </Container>
  )
}
