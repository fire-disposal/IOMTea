import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Skeleton,
  Stack,
  Tabs,
  Text,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconHeart,
  IconLungs,
  IconHeartbeat,
  IconTemperatureCelsius,
} from '@tabler/icons-react'
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { trpc } from '../../../trpc'

function genderLabel(g: string) {
  if (g === 'male') return '男'
  if (g === 'female') return '女'
  return '其他'
}

export function PatientDetailShell({ children }: { children: ReactNode }) {
  const { id } = useParams({ from: '/_auth/patients/$id' })
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const patient = trpc.patient.byId.useQuery({ id: id! }, { enabled: !!id })
  const latestVitals = trpc.data.latest.useQuery(
    { patientId: id! },
    { enabled: !!id, refetchInterval: 15000 },
  )

  const hr = latestVitals.data?.find((v: any) => v.metric === 'heart_rate')?.value
  const spo2 = latestVitals.data?.find((v: any) => v.metric === 'spo2')?.value
  const systolic = latestVitals.data?.find((v: any) => v.metric === 'systolic_bp')?.value
  const diastolic = latestVitals.data?.find((v: any) => v.metric === 'diastolic_bp')?.value
  const temp = latestVitals.data?.find((v: any) => v.metric === 'temperature')?.value
  const isOnline = (latestVitals.data?.length ?? 0) > 0

  const tabValue = pathname.includes('/health-timeline')
    ? 'health-timeline'
    : pathname.includes('/alert-rules')
      ? 'alert-rules'
      : pathname.includes('/alerts')
        ? 'alerts'
        : pathname.includes('/medications')
          ? 'medications'
          : pathname.includes('/profile')
            ? 'profile'
            : 'overview'

  if (patient.isLoading) {
    return (
      <Stack h="calc(100vh - 56px)" gap={0}>
        <Group px="lg" py="sm" bg="matchaGreen.1">
          <Skeleton height={24} width={200} radius="sm" />
        </Group>
        <Center flex={1}>
          <Skeleton height={300} width="90%" radius="md" />
        </Center>
      </Stack>
    )
  }
  if (patient.isError) {
    return (
      <Stack h="calc(100vh - 56px)" align="center" justify="center">
        <Alert color="red" title="加载失败">
          无法获取患者信息，请检查网络后重试。
        </Alert>
        <Button mt="md" variant="light" onClick={() => navigate({ to: '/patients' })}>
          返回列表
        </Button>
      </Stack>
    )
  }
  if (!patient.data) {
    return (
      <Stack h="calc(100vh - 56px)" align="center" justify="center">
        <Alert color="red" title="患者不存在">
          该患者可能已被删除，请返回列表。
        </Alert>
        <Button mt="md" variant="light" onClick={() => navigate({ to: '/patients' })}>
          返回列表
        </Button>
      </Stack>
    )
  }

  const p = patient.data as any
  const age = p.birthDate
    ? Math.floor((Date.now() - new Date(p.birthDate).getTime()) / 31557600000)
    : null

  return (
    <Stack h="calc(100vh - 56px)" gap={0}>
      <Group
        px="lg"
        py="sm"
        bg="matchaGreen.1"
        style={{ borderBottom: '1px solid var(--mantine-color-matchaGreen-3)' }}
        justify="space-between"
        wrap="nowrap"
      >
        <Group gap="sm" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="matchaGreen"
            onClick={() => navigate({ to: '/patients' })}
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Text fw={700} size="md">
              {p.name}
            </Text>
            <Text size="xs" c="dimmed">
              {genderLabel(p.gender)}
              {age != null ? ` · ${age}岁` : ''}
              {p.bloodType ? ` · ${p.bloodType}型血` : ''}
            </Text>
          </div>
        </Group>
        <Group gap="md" wrap="nowrap">
          <Group gap={4}>
            <IconHeart size={14} color="var(--mantine-color-red-6)" />
            <Text size="sm" fw={500}>
              {hr != null ? hr : '--'}{' '}
              <Text span size="xs" c="dimmed">
                bpm
              </Text>
            </Text>
          </Group>
          <Group gap={4}>
            <IconLungs size={14} color="var(--mantine-color-blue-6)" />
            <Text size="sm" fw={500}>
              {spo2 != null ? spo2 : '--'}
              <Text span size="xs" c="dimmed">
                %
              </Text>
            </Text>
          </Group>
          <Group gap={4}>
            <IconHeartbeat size={14} color="var(--mantine-color-orange-6)" />
            <Text size="sm" fw={500}>
              {systolic != null ? systolic : '--'}/{diastolic != null ? diastolic : '--'}
              <Text span size="xs" c="dimmed">
                {' '}
                mmHg
              </Text>
            </Text>
          </Group>
          <Group gap={4}>
            <IconTemperatureCelsius size={14} color="var(--mantine-color-green-6)" />
            <Text size="sm" fw={500}>
              {temp != null ? temp : '--'}
              <Text span size="xs" c="dimmed">
                °C
              </Text>
            </Text>
          </Group>
          <Divider orientation="vertical" size="sm" />
        </Group>
      </Group>

      <Tabs
        color="matchaGreen"
        value={tabValue}
        onChange={(v) => {
          if (!id) return
          if (v === 'overview') navigate({ to: '/patients/$id', params: { id } })
          else navigate({ to: `/patients/$id/${v}`, params: { id } } as any)
        }}
      >
        <Tabs.List px="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <Tabs.Tab value="overview">概览</Tabs.Tab>
          <Tabs.Tab value="health-timeline">时间轴</Tabs.Tab>
          <Tabs.Tab value="alerts">告警</Tabs.Tab>
          <Tabs.Tab value="alert-rules">规则</Tabs.Tab>
          <Tabs.Tab value="medications">用药</Tabs.Tab>
          <Tabs.Tab value="profile">档案</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Box flex={1} mih={0} p="md" style={{ overflow: 'auto' }}>
        {children}
      </Box>
    </Stack>
  )
}
