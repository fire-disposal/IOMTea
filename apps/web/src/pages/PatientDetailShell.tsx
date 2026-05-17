import { Alert, Badge, Group, Skeleton, Tabs, Text } from '@mantine/core'
import { IconArrowLeft, IconHeart, IconLungs, IconHeartbeat, IconTemperatureCelsius } from '@tabler/icons-react'
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { trpc } from '../trpc'

function genderLabel(g: string) {
  if (g === 'male') return '男'
  if (g === 'female') return '女'
  return '其他'
}

export function PatientDetailShell({ children }: { children: ReactNode }) {
  const { id } = (useParams as any)({ from: '/_auth/patients/$id' })
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const patient = trpc.patient.byId.useQuery({ id: id! }, { enabled: !!id })
  const latestVitals = trpc.data.latest.useQuery({ patientId: id! }, { enabled: !!id, refetchInterval: 15000 })
  const engineStatus = trpc.twin.engine.status.useQuery({ patientId: id! }, { enabled: !!id, refetchInterval: 5000 })

  const hr = latestVitals.data?.find((v: any) => v.metric === 'heart_rate')?.value
  const spo2 = latestVitals.data?.find((v: any) => v.metric === 'spo2')?.value
  const systolic = latestVitals.data?.find((v: any) => v.metric === 'systolic_bp')?.value
  const diastolic = latestVitals.data?.find((v: any) => v.metric === 'diastolic_bp')?.value
  const temp = latestVitals.data?.find((v: any) => v.metric === 'temperature')?.value
  const isOnline = (latestVitals.data?.length ?? 0) > 0

  const tabValue = pathname.includes('/map-editor') ? 'map-editor'
    : pathname.includes('/alerts') ? 'alerts'
    : pathname.includes('/medications') ? 'medications'
    : pathname.includes('/appointments') ? 'appointments'
    : pathname.includes('/profile') ? 'profile'
    : 'overview'

  if (patient.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
        <Group px="lg" py="sm" bg="matchaGreen.1">
          <Skeleton height={24} width={200} radius="sm" />
        </Group>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Skeleton height={300} width="90%" radius="md" />
        </div>
      </div>
    )
  }
  if (!patient.data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', alignItems: 'center', justifyContent: 'center' }}>
        <Alert color="red" title="患者不存在">无法加载该患者信息，请返回列表重试。</Alert>
      </div>
    )
  }

  const p = patient.data as any
  const es = (engineStatus.data && !Array.isArray(engineStatus.data)) ? engineStatus.data : null
  const isRunning = es?.running ?? false
  const speed = es?.speed ?? 1
  const age = p.birthDate ? Math.floor((Date.now() - new Date(p.birthDate).getTime()) / 31557600000) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      <Group
        px="lg" py="sm"
        bg="matchaGreen.1"
        style={{ borderBottom: '1px solid var(--mantine-color-matchaGreen-3)' }}
        justify="space-between"
        wrap="nowrap"
      >
        <Group gap="sm" wrap="nowrap">
          <IconArrowLeft size={20} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate({ to: '/patients' })} />
          <div>
            <Text fw={700} size="md">{p.name}</Text>
            <Text size="xs" c="dimmed">
              {genderLabel(p.gender)}{age != null ? ` · ${age}岁` : ''}
              {p.bloodType ? ` · ${p.bloodType}型血` : ''}
            </Text>
          </div>
        </Group>
        <Group gap="md" wrap="nowrap">
          <Group gap={4}>
            <IconHeart size={14} color="var(--mantine-color-red-6)" />
            <Text size="sm" fw={500}>{hr != null ? hr : '--'} <Text span size="xs" c="dimmed">bpm</Text></Text>
          </Group>
          <Group gap={4}>
            <IconLungs size={14} color="var(--mantine-color-blue-6)" />
            <Text size="sm" fw={500}>{spo2 != null ? spo2 : '--'}<Text span size="xs" c="dimmed">%</Text></Text>
          </Group>
          <Group gap={4}>
            <IconHeartbeat size={14} color="var(--mantine-color-orange-6)" />
            <Text size="sm" fw={500}>
              {systolic != null ? systolic : '--'}/{diastolic != null ? diastolic : '--'}
              <Text span size="xs" c="dimmed"> mmHg</Text>
            </Text>
          </Group>
          <Group gap={4}>
            <IconTemperatureCelsius size={14} color="var(--mantine-color-green-6)" />
            <Text size="sm" fw={500}>{temp != null ? temp : '--'}<Text span size="xs" c="dimmed">°C</Text></Text>
          </Group>
          <div style={{ width: 1, height: 20, background: 'var(--mantine-color-gray-4)' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-gray-5)' }} />
          <Text size="xs" c={isOnline ? 'green' : 'dimmed'}>{isOnline ? '在线' : '离线'}</Text>
          <div style={{ width: 1, height: 20, background: 'var(--mantine-color-gray-4)' }} />
          <Badge color={isRunning ? 'green' : 'gray'} variant="light" size="sm">
            {isRunning ? '运行中' : '已暂停'}
          </Badge>
          <Badge variant="outline" size="sm">{speed}x</Badge>
        </Group>
      </Group>

      <Tabs value={tabValue} onChange={(v) => {
        if (!id) return
        if (v === 'overview') navigate({ to: '/patients/$id', params: { id } as any })
        else navigate({ to: '/patients/$id/' + v as any, params: { id } as any })
      }}>
        <Tabs.List px="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <Tabs.Tab value="overview">概览</Tabs.Tab>
          <Tabs.Tab value="alerts">告警</Tabs.Tab>
          <Tabs.Tab value="medications">用药</Tabs.Tab>
          <Tabs.Tab value="appointments">预约</Tabs.Tab>
          <Tabs.Tab value="profile">档案</Tabs.Tab>
          <Tabs.Tab value="map-editor">地图编辑</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
        {children}
      </div>
    </div>
  )
}
