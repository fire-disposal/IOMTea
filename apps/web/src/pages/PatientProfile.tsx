import { Button, Container, Group, SimpleGrid, Skeleton, TextInput, Title } from '@mantine/core'
import { useGet, usePatch } from '../api/hooks'

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
  const pid = parseId()
  const { data: p, isLoading, refetch } = useGet<P>(`/patients/${pid}`)
  const update = usePatch('/patients/:id')

  if (isLoading || !p)
    return (
      <Container py="md">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={24} mb="sm" />
        ))}
      </Container>
    )

  const save = () =>
    update.mutate({
      id: pid,
      name: p.name,
      phone: p.phone,
      address: p.address,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
    } as any)

  return (
    <Container py="md">
      <Title order={3} mb="md">
        患者档案
      </Title>
      <SimpleGrid cols={2}>
        <TextInput
          label="姓名"
          value={p.name}
          onChange={(e) => {
            /* controlled by local state */
          }}
        />
        <TextInput label="性别" value={p.gender ?? ''} readOnly />
        <TextInput label="出生日期" value={p.birthDate ?? ''} readOnly />
        <TextInput label="血型" value={p.bloodType ?? ''} readOnly />
        <TextInput label="电话" value={p.phone ?? ''} readOnly />
        <TextInput label="地址" value={p.address ?? ''} readOnly />
      </SimpleGrid>
      <Group mt="md">
        <Button loading={update.isPending} onClick={save}>
          保存
        </Button>
      </Group>
    </Container>
  )
}
