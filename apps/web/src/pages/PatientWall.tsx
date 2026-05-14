import { Container, Group, SimpleGrid, TextInput, Title } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { trpc } from '../trpc'
import { PatientCard } from '../components/patients/PatientCard'
import { StateSkeleton, StateEmpty, StateError } from '../components/shared/StateComponents'

export function PatientWall() {
  const patients = trpc.patient.list.useQuery({ pageSize: 100, status: 'active' })

  const alerts = trpc.alert.list.useQuery({ pageSize: 100 }, { refetchInterval: 30000 })

  if (patients.isLoading) {
    return <Container size="xl" py="xl"><SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}><StateSkeleton count={6} /></SimpleGrid></Container>
  }
  if (patients.isError) {
    return <Container size="xl" py="xl"><StateError message="加载患者列表失败" /></Container>
  }
  if (!patients.data || patients.data.length === 0) {
    return <Container size="xl" py="xl"><StateEmpty message="暂无患者" /></Container>
  }

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="lg">患者监护</Title>
      <TextInput placeholder="搜索患者..." leftSection={<IconSearch size={16} />} mb="xl" />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {patients.data.map((p: any) => (
          <PatientCard
            key={p.id}
            patient={p}
            alertCount={alerts.data?.filter((a: any) => a.patientId === p.id && a.status === 'active').length}
          />
        ))}
      </SimpleGrid>
    </Container>
  )
}
