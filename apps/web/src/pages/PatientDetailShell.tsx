import {
  Badge,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import {
  IconActivity,
  IconAlertTriangle,
  IconChartLine,
  IconSettings,
  IconUser,
} from '@tabler/icons-react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface Patient {
  id: string
  name: string
  gender: string | null
  birthDate: string | null
  heightCm: number | null
  weightKg: number | null
  bloodType: string | null
  phone: string | null
  address: string | null
  status: string
}
interface LatestItem {
  metric: string
  value: unknown
  unit: string | null
  recordedAt: number | null
}

function parsePatientId(): string {
  return window.location.pathname.split('/patients/')[1]?.split('/')[0] || ''
}

export function PatientDetailShell({ children }: { children?: React.ReactNode }) {
  const patientId = parsePatientId()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [latest, setLatest] = useState<LatestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    Promise.all([
      http.get('/patients/' + patientId),
      http.get('/data/latest', { params: { patientId } }),
    ])
      .then(([pRes, dRes]) => {
        setPatient(pRes.data as Patient)
        setLatest(dRes.data as LatestItem[])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [patientId])

  const tabValue = pathname.includes('/profile')
    ? 'profile'
    : pathname.includes('/alerts')
      ? 'alerts'
      : pathname.includes('/alert-rules')
        ? 'rules'
        : pathname.includes('/health-timeline')
          ? 'timeline'
          : 'overview'

  if (loading)
    return (
      <Container py="md">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={24} mb="sm" />
        ))}
      </Container>
    )
  if (error || !patient)
    return (
      <Container py="md">
        <Paper p="xl" withBorder ta="center">
          <Text c="red">{error || '未找到患者'}</Text>
        </Paper>
      </Container>
    )

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>{patient.name}</Title>
        <Badge size="lg" color={patient.status === 'active' ? 'teal' : 'gray'}>
          {patient.status}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        <Paper p="xs" withBorder>
          <Text size="xs" c="dimmed">
            性别
          </Text>
          <Text>{patient.gender ?? '-'}</Text>
        </Paper>
        <Paper p="xs" withBorder>
          <Text size="xs" c="dimmed">
            出生日期
          </Text>
          <Text>{patient.birthDate ?? '-'}</Text>
        </Paper>
        <Paper p="xs" withBorder>
          <Text size="xs" c="dimmed">
            身高/体重
          </Text>
          <Text>
            {patient.heightCm ? patient.heightCm + 'cm / ' : ''}
            {patient.weightKg ? patient.weightKg + 'kg' : '-'}
          </Text>
        </Paper>
        <Paper p="xs" withBorder>
          <Text size="xs" c="dimmed">
            血型/电话
          </Text>
          <Text>{[patient.bloodType, patient.phone].filter(Boolean).join(' / ') || '-'}</Text>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        {latest.slice(0, 4).map((m) => (
          <Paper key={m.metric} p="xs" withBorder>
            <Text size="xs" c="dimmed">
              {m.metric}
            </Text>
            <Text fw={600}>
              {String(m.value ?? '-')} {m.unit ?? ''}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>

      <Tabs
        value={tabValue}
        onChange={(v) => {
          if (!v) return
          const base = '/patients/' + patientId
          const map: Record<string, string> = {
            overview: base,
            profile: base + '/profile',
            alerts: base + '/alerts',
            rules: base + '/alert-rules',
            timeline: base + '/health-timeline',
          }
          navigate({ to: map[v] || base })
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconActivity size={14} />}>
            概览
          </Tabs.Tab>
          <Tabs.Tab value="profile" leftSection={<IconUser size={14} />}>
            档案
          </Tabs.Tab>
          <Tabs.Tab value="alerts" leftSection={<IconAlertTriangle size={14} />}>
            告警
          </Tabs.Tab>
          <Tabs.Tab value="rules" leftSection={<IconSettings size={14} />}>
            阈值
          </Tabs.Tab>
          <Tabs.Tab value="timeline" leftSection={<IconChartLine size={14} />}>
            时间线
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {children || <Outlet />}
    </Container>
  )
}
