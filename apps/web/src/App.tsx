import { useEffect, useState } from 'react'
import { Container, Title, Group, Button, Badge, Card, Text, Grid, Paper, Stack, Loader, Tabs, ActionIcon, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useAuthStore } from './store/auth'
import { trpc } from './trpc'
import { LoginPage } from './LoginPage'
import { PatientListPage } from './pages/PatientListPage'
import { DeviceListPage } from './pages/DeviceListPage'

function Dashboard() {
  const logout = useAuthStore((s) => s.logout)
  const [patientIds, setPatientIds] = useState<string[]>([])
  const [patientNames, setPatientNames] = useState<string[]>([])
  const [wardId, setWardId] = useState<string>('')
  const [ready, setReady] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>('dashboard')

  // Fetch ward status (auto-started by server in demo mode)
  const wardStatus = trpc.simulator.status.useQuery(undefined, { refetchInterval: 5000 })
  const patientList = trpc.patient.list.useQuery({ pageSize: 20, status: 'active' }, { refetchInterval: 10000 })
  const alertCount = trpc.alert.list.useQuery({ pageSize: 1, status: 'active' }, { refetchInterval: 3000 })

  const inject = trpc.simulator.injectScenario.useMutation({
    onSuccess: () => notifications.show({ title: '场景已注入', message: '查看告警面板', color: 'orange' }),
  })

  useEffect(() => {
    if (wardStatus.data && Array.isArray(wardStatus.data) && wardStatus.data.length > 0) {
      setWardId(wardStatus.data[0].id)
    }
    if (patientList.data && patientList.data.length > 0 && !ready) {
      setPatientIds(patientList.data.map((p: any) => p.id))
      setPatientNames(patientList.data.map((p: any) => p.name))
      setReady(true)
    }
  }, [wardStatus.data, patientList.data, ready])

  const latestQueries = [
    trpc.data.latest.useQuery({ patientId: patientIds[0] || '' }, { enabled: ready && !!patientIds[0], refetchInterval: 2000 }),
    trpc.data.latest.useQuery({ patientId: patientIds[1] || '' }, { enabled: ready && !!patientIds[1], refetchInterval: 2000 }),
    trpc.data.latest.useQuery({ patientId: patientIds[2] || '' }, { enabled: ready && !!patientIds[2], refetchInterval: 2000 }),
  ]

  const alerts = trpc.alert.list.useQuery({ pageSize: 15, status: 'active' }, { refetchInterval: 3000 })
  const pause = trpc.simulator.pause.useMutation()
  const resume = trpc.simulator.resume.useMutation()

  const severityColor: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' }
  const wardRunning = wardStatus.data && Array.isArray(wardStatus.data) && wardStatus.data[0]?.running

  if (!ready) {
    return <Container size="xl" py="xl"><Loader /><Text mt="md">连接服务器...</Text></Container>
  }

  const injectActions = [
    { label: '离床', type: 'bed_exit' as const, color: 'orange' },
    { label: '心动过速', type: 'tachycardia' as const, color: 'red' },
    { label: '跌倒', type: 'fall' as const, color: 'red' },
    { label: '低血氧', type: 'low_spo2' as const, color: 'red' },
  ]

  const dashboardView = (
    <Container size="xl" py="md">
      {/* Control bar */}
      <Group justify="space-between" mb="md">
        <Group>
          <Badge color={wardRunning ? 'green' : 'gray'} size="lg" variant="filled">
            {wardRunning ? '● 运行中' : '○ 已暂停'}
          </Badge>
        </Group>
        <Group gap="xs">
          {wardRunning
            ? <Button size="xs" variant="light" color="orange" onClick={() => pause.mutate({ wardId })}>暂停仿真</Button>
            : <Button size="xs" variant="light" color="green" onClick={() => resume.mutate({ wardId })}>恢复仿真</Button>
          }
        </Group>
      </Group>

      {/* Inject scenario buttons */}
      <Paper p="sm" mb="md" withBorder bg="gray.0">
        <Group gap="xs">
          <Text size="xs" fw={600} c="dimmed">演示注入:</Text>
          {injectActions.map(a => (
            <Button key={a.type} size="compact-xs" variant="filled" color={a.color} loading={inject.isPending}
              onClick={() => inject.mutate({ wardId, type: a.type })}>
              {a.label}
            </Button>
          ))}
        </Group>
      </Paper>

      <Grid>
        <Grid.Col span={8}>
          <Title order={5} mb="sm">患者监护</Title>
          <Grid>
            {patientNames.map((name, i) => {
              const query = latestQueries[i]
              const vitals = query?.data || []
              const gv = (m: string) => vitals.find((v: any) => v.metric === m)
              const hr = gv('heart_rate'), rr = gv('resp_rate'), spo2 = gv('spo2'), temp = gv('temperature')

              return (
                <Grid.Col span={4} key={i}>
                  <Card shadow="sm" padding="md" radius="md" withBorder>
                    <Group justify="space-between" mb="xs">
                      <Text fw={700}>{name}</Text>
                      <Badge size="xs" variant="dot" color="green">在线</Badge>
                    </Group>
                    <Paper bg="gray.0" p="sm" radius="md">
                      <Grid>
                        <Grid.Col span={6}><Stack gap={0}>
                          <Text size="xs" c="dimmed">心率</Text>
                          <Text size="xl" fw={700} c={hr && hr.value != null && hr.value > 120 ? 'red' : hr && hr.value != null && hr.value < 50 ? 'orange' : 'green'}>
                            {hr && hr.value != null ? `${hr.value}` : '--'}<Text component="span" size="sm" fw={400}> bpm</Text>
                          </Text>
                        </Stack></Grid.Col>
                        <Grid.Col span={6}><Stack gap={0}>
                          <Text size="xs" c="dimmed">呼吸率</Text>
                          <Text size="xl" fw={700} c="blue">
                            {rr && rr.value != null ? `${rr.value}` : '--'}<Text component="span" size="sm" fw={400}> rpm</Text>
                          </Text>
                        </Stack></Grid.Col>
                        <Grid.Col span={6}><Stack gap={0}>
                          <Text size="xs" c="dimmed">血氧</Text>
                          <Text size="xl" fw={700} c={spo2 && spo2.value != null && spo2.value < 92 ? 'red' : 'green'}>
                            {spo2 && spo2.value != null ? `${spo2.value}` : '--'}<Text component="span" size="sm" fw={400}> %</Text>
                          </Text>
                        </Stack></Grid.Col>
                        <Grid.Col span={6}><Stack gap={0}>
                          <Text size="xs" c="dimmed">体温</Text>
                          <Text size="xl" fw={700}>
                            {temp && temp.value != null ? `${temp.value}` : '--'}<Text component="span" size="sm" fw={400}> °C</Text>
                          </Text>
                        </Stack></Grid.Col>
                      </Grid>
                    </Paper>
                  </Card>
                </Grid.Col>
              )
            })}
          </Grid>
        </Grid.Col>

        <Grid.Col span={4}>
          <Title order={5} mb="sm">告警时间线</Title>
          <Paper p="sm" withBorder style={{ maxHeight: 520, overflow: 'auto' }}>
            {(!alerts.data || alerts.data.length === 0) && <Text size="sm" c="dimmed" ta="center" py="xl">无活跃告警</Text>}
            {alerts.data?.map((a: any) => (
              <Paper key={a.id} p="xs" mb="xs" bg={`${severityColor[a.severity]}.0`} radius="sm">
                <Group gap={4} wrap="nowrap">
                  <Badge size="xs" color={severityColor[a.severity]} variant="filled">{a.severity}</Badge>
                  <Text size="xs" fw={500}>{a.tags?.message || a.metric}</Text>
                </Group>
                <Group gap={8} mt={4}>
                  <Text size="xs" c="dimmed">{new Date(a.recordedAt).toLocaleTimeString()}</Text>
                  {a.value != null && <Text size="xs" c="dimmed">值: {a.value}{a.unit || ''}</Text>}
                </Group>
              </Paper>
            ))}
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  )

  return (
    <>
      <Group px="md" pt="md" justify="space-between">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="dashboard" rightSection={
              alertCount.data && alertCount.data.length > 0
                ? <Badge size="xs" color="red" variant="filled" style={{ minWidth: 18 }}>{alertCount.data.length}</Badge>
                : undefined
            }>监护面板</Tabs.Tab>
            <Tabs.Tab value="patients">患者管理</Tabs.Tab>
            <Tabs.Tab value="devices">设备管理</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        <Button size="xs" variant="subtle" color="red" onClick={logout}>退出</Button>
      </Group>

      {activeTab === 'dashboard' && dashboardView}
      {activeTab === 'patients' && <PatientListPage />}
      {activeTab === 'devices' && <DeviceListPage />}
    </>
  )
}

export function App() {
  const token = useAuthStore((s) => s.token)
  return token ? <Dashboard /> : <LoginPage />
}
