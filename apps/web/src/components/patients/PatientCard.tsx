import { ActionIcon, Avatar, Badge, Box, Card, Group, Text } from '@mantine/core'
import { IconHeart, IconLungs, IconAlertCircle, IconTrash } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
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
  onDelete?: (id: string) => void
}

export function PatientCard({ patient, alertCount = 0, onDelete }: PatientCardProps) {
  const latestVitals = trpc.data.latest.useQuery(
    { patientId: patient.id },
    { enabled: !!patient.id, refetchInterval: 15000 }
  )

  const vitals = {
    heartRate: latestVitals.data?.find((v: any) => v.metric === 'heart_rate')?.value as number | undefined,
    spO2: latestVitals.data?.find((v: any) => v.metric === 'spo2')?.value as number | undefined,
  }
  const isOnline = (latestVitals.data?.length ?? 0) > 0
  const navigate = useNavigate()
  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / 31557600000)
    : null

  const hrColor = vitals?.heartRate && (vitals.heartRate > 100 || vitals.heartRate < 50) ? 'red' : undefined
  const spO2Color = vitals?.spO2 && vitals.spO2 < 92 ? 'red' : undefined
  const conditions = (patient.tags as any)?.conditions || []

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      className="card-hover"
      style={{ cursor: 'pointer', position: 'relative' }}
      onClick={() => navigate({ to: '/patients/$id', params: { id: patient.id } })}
    >
      {onDelete && (
        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          pos="absolute" top={8} right={8} style={{ zIndex: 1 }}
          onClick={(e) => { e.stopPropagation(); onDelete(patient.id) }}
        >
          <IconTrash size={14} />
        </ActionIcon>
      )}

      <Group mb="md" wrap="nowrap">
        <Avatar color="matchaGreen" radius="xl" size="lg">
          {patient.name.charAt(0)}
        </Avatar>
        <Box flex={1} style={{ minWidth: 0 }}>
          <Text fw={600} truncate>{patient.name}</Text>
          <Group gap={6} mt={2}>
            {age != null && <Text size="xs" c="dimmed">{age}岁</Text>}
              {patient.gender && <Text size="xs" c="dimmed">{patient.gender === 'male' ? '男' : patient.gender === 'female' ? '女' : '其他'}</Text>}
          </Group>
        </Box>
        {alertCount > 0 && (
          <Badge color="red" variant="filled" leftSection={<IconAlertCircle size={12} />}>
            {alertCount}
          </Badge>
        )}
      </Group>

      {conditions.length > 0 && (
        <Group gap={4} mb="md">
          {conditions.slice(0, 3).map((c: any) => (
            <Badge key={c} size="xs" variant="outline" color="matchaGreen">{c}</Badge>
          ))}
        </Group>
      )}

      <Group gap="xl">
        <Group gap={4}>
          <IconHeart size={16} color={hrColor ? `var(--mantine-color-red-6)` : `var(--mantine-color-gray-5)`} />
          <Text size="sm" fw={500} c={hrColor ? 'red' : undefined}>
            {vitals?.heartRate ?? '--'} <Text span size="xs" c="dimmed">bpm</Text>
          </Text>
        </Group>
        <Group gap={4}>
          <IconLungs size={16} color={spO2Color ? `var(--mantine-color-red-6)` : `var(--mantine-color-gray-5)`} />
          <Text size="sm" fw={500} c={spO2Color ? 'red' : undefined}>
            {vitals?.spO2 ?? '--'}<Text span size="xs" c="dimmed">%</Text>
          </Text>
        </Group>
      </Group>
    </Card>
  )
}
