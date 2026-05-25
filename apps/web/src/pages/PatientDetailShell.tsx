import { Container, Title, Paper, Text, Group, Badge, SimpleGrid } from '@mantine/core'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface Patient {
  id: string; name: string; gender: string | null; birthDate: string | null
  heightCm: number | null; weightKg: number | null; bloodType: string | null
  phone: string | null; address: string | null; status: string
}

interface LatestData { metric: string; value: unknown; unit: string | null; recordedAt: number | null }

export function PatientDetailShell({ children, patientId }: { children?: React.ReactNode; patientId: string }) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [latest, setLatest] = useState<LatestData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      http.get('/patients/' + patientId),
      http.get('/data/latest', { params: { patientId } }),
    ]).then(([patRes, dataRes]) => {
      setPatient(patRes.data as Patient)
      setLatest(dataRes.data as LatestData[])
      setLoading(false)
    })
  }, [patientId])

  if (loading || !patient) return <Container py="md"><p>Loading...</p></Container>

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>{patient.name}</Title>
        <Badge>{patient.status}</Badge>
      </Group>
      <SimpleGrid cols={2} mb="md">
        <Paper p="sm" withBorder><Text size="xs" c="dimmed">性别</Text><Text>{patient.gender ?? '-'}</Text></Paper>
        <Paper p="sm" withBorder><Text size="xs" c="dimmed">出生日期</Text><Text>{patient.birthDate ?? '-'}</Text></Paper>
        <Paper p="sm" withBorder><Text size="xs" c="dimmed">身高</Text><Text>{patient.heightCm ? patient.heightCm + ' cm' : '-'}</Text></Paper>
        <Paper p="sm" withBorder><Text size="xs" c="dimmed">体重</Text><Text>{patient.weightKg ? patient.weightKg + ' kg' : '-'}</Text></Paper>
        <Paper p="sm" withBorder><Text size="xs" c="dimmed">血型</Text><Text>{patient.bloodType ?? '-'}</Text></Paper>
        <Paper p="sm" withBorder><Text size="xs" c="dimmed">电话</Text><Text>{patient.phone ?? '-'}</Text></Paper>
      </SimpleGrid>
      <Title order={4} mb="sm">最新体征</Title>
      <SimpleGrid cols={4}>
        {latest.map((m) => (
          <Paper key={m.metric} p="xs" withBorder>
            <Text size="xs" c="dimmed">{m.metric}</Text>
            <Text fw={600}>{String(m.value ?? '-')} {m.unit ?? ''}</Text>
          </Paper>
        ))}
      </SimpleGrid>
    </Container>
  )
}

export function PatientOverview() {
  return <Container py="md"><Text>Overview</Text></Container>
}
