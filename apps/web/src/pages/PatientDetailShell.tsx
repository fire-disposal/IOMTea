import { Badge, Group, Tabs, Text, ThemeIcon, Title } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom'
import { trpc } from '../trpc'

export function PatientDetailShell() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const patient = trpc.patient.byId.useQuery({ id: id! }, { enabled: !!id })
  const latestVitals = trpc.data.latest.useQuery({ patientId: id! }, { enabled: !!id, refetchInterval: 15000 })

  const hr = latestVitals.data?.find((v: any) => v.metric === 'heart_rate')?.value
  const spo2 = latestVitals.data?.find((v: any) => v.metric === 'spo2')?.value
  const isOnline = (latestVitals.data?.length ?? 0) > 0

  const tabValue = location.pathname.includes('/alerts') ? 'alerts'
    : location.pathname.includes('/medications') ? 'medications'
    : location.pathname.includes('/appointments') ? 'appointments'
    : location.pathname.includes('/profile') ? 'profile'
    : 'overview'

  if (!patient.data) return null

  return (
    <>
      <Group mb="md">
        <IconArrowLeft size={24} style={{ cursor: 'pointer' }} onClick={() => navigate('/patients')} />
        <Title order={3}>{patient.data.name}</Title>
        <Badge color={patient.data.status === 'active' ? 'green' : 'gray'} variant="light">{patient.data.status}</Badge>
        <Group gap="xs">
          <Text size="sm" c="dimmed">❤ {hr ?? '--'}</Text>
          <Text size="sm" c="dimmed">🫁 {spo2 ?? '--'}%</Text>
          <ThemeIcon size={10} radius="xl" color={isOnline ? 'green' : 'gray'} />
        </Group>
      </Group>

      <Tabs value={tabValue} onChange={(v) => navigate(`/patients/${id}/${v === 'overview' ? '' : v}`)}>
        <Tabs.List>
          <Tabs.Tab value="overview">概览</Tabs.Tab>
          <Tabs.Tab value="alerts">告警</Tabs.Tab>
          <Tabs.Tab value="medications">用药</Tabs.Tab>
          <Tabs.Tab value="appointments">预约</Tabs.Tab>
          <Tabs.Tab value="profile">档案</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Outlet />
    </>
  )
}
