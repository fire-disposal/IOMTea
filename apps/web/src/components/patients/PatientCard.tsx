import { Badge, Card, Group, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconHeart, IconLungs, IconAlertCircle } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { trpc } from '../../trpc'

interface PatientCardProps {
  patient: {
    id: string
    name: string
    birthDate?: string | null
    gender?: string | null
    status: string
    tags?: any
  }
  alertCount?: number
  deviceOnline?: boolean
}

export function PatientCard({ patient, alertCount = 0, deviceOnline = false }: PatientCardProps) {
  const latestVitals = trpc.data.latest.useQuery(
    { patientId: patient.id },
    { enabled: !!patient.id, refetchInterval: 15000 }
  )

  const vitals = {
    heartRate: latestVitals.data?.find((v: any) => v.metric === 'heart_rate')?.value as number | undefined,
    spO2: latestVitals.data?.find((v: any) => v.metric === 'spo2')?.value as number | undefined,
  }
  const navigate = useNavigate()
  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / 31557600000)
    : null

  const hrColor = vitals?.heartRate && (vitals.heartRate > 100 || vitals.heartRate < 50) ? 'red' : 'matchaGreen'
  const spO2Color = vitals?.spO2 && vitals.spO2 < 92 ? 'red' : 'matchaGreen'
  const conditions = (patient.tags as any)?.conditions || []

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      style={{ cursor: 'pointer', borderTop: '3px solid var(--mantine-color-matchaGreen-5)' }}
      onClick={() => navigate(`/patients/${patient.id}`)}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Text fw={600} size="lg">{patient.name}</Text>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: deviceOnline ? '#6BA539' : '#ccc' }} />
        </Group>
        {alertCount > 0 && (
          <Badge color="red" variant="filled" leftSection={<IconAlertCircle size={12} />}>
            {alertCount}
          </Badge>
        )}
      </Group>

      <Group gap="xs" mb="md">
        {age && <Text size="sm" c="dimmed">{age}岁</Text>}
        {patient.gender && <Text size="sm" c="dimmed">{patient.gender === 'male' ? '男' : patient.gender === 'female' ? '女' : '其他'}</Text>}
        {Array.isArray(conditions) && conditions.slice(0, 2).map((c: any) => (
          <Badge key={c} size="xs" variant="light" color="gray">{c}</Badge>
        ))}
      </Group>

      <Group gap="xl">
        <Group gap={4}>
          <IconHeart size={16} color={`var(--mantine-color-${hrColor}-6)`} />
          <Text size="sm" fw={500} c={hrColor === 'red' ? 'red' : undefined}>
            {vitals?.heartRate ?? '--'} bpm
          </Text>
        </Group>
        <Group gap={4}>
          <IconLungs size={16} color={`var(--mantine-color-${spO2Color}-6)`} />
          <Text size="sm" fw={500} c={spO2Color === 'red' ? 'red' : undefined}>
            {vitals?.spO2 ?? '--'}%
          </Text>
        </Group>
      </Group>
    </Card>
  )
}
