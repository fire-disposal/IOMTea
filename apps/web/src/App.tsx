import { useEffect, useState } from 'react'
import { Container, Title, Group, Button, Badge, Card, Text, Grid, Paper, Stack, Loader } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useAuthStore } from './store/auth'
import { trpc } from './trpc'
import { LoginPage } from './LoginPage'

function Dashboard() {
  const logout = useAuthStore((s) => s.logout)
  const [wardId, setWardId] = useState<string | null>(null)
  const [patientIds, setPatientIds] = useState<string[]>([])
  const [wardReady, setWardReady] = useState(false)

  const createWard = trpc.simulator.createWard.useMutation()

  const patientList = trpc.patient.list.useQuery(
    { pageSize: 20, status: 'active' },
    { enabled: !!wardId, refetchInterval: false },
  )

  useEffect(() => {
    createWard.mutate({
      name: 'ICU 观察病房',
      patients: [
        { profileId: 'elderly-cardiac', count: 3 },
      ],
      speed: 1,
    }, {
      onSuccess: (data) => {
        setWardId(data.id)
        notifications.show({ title: '病房已创建', message: `${data.name} — ${data.patientCount} 名患者`, color: 'green' })
      },
    })
  }, [])

  useEffect(() => {
    if (wardId && patientList.data && patientList.data.length > 0 && !wardReady) {
      const ids = patientList.data.map((p: any) => p.id)
      setPatientIds(ids)
      setWardReady(true)
    }
  }, [wardId, patientList.data, wardReady])

  const latestQueries = [
    trpc.data.latest.useQuery(
      { patientId: patientIds[0] || '' },
      { enabled: wardReady && !!patientIds[0], refetchInterval: 2000 },
    ),
    trpc.data.latest.useQuery(
      { patientId: patientIds[1] || '' },
      { enabled: wardReady && !!patientIds[1], refetchInterval: 2000 },
    ),
    trpc.data.latest.useQuery(
      { patientId: patientIds[2] || '' },
      { enabled: wardReady && !!patientIds[2], refetchInterval: 2000 },
    ),
  ]

  const alerts = trpc.alert.list.useQuery(
    { pageSize: 10 },
    { refetchInterval: 3000 },
  )

  const pause = trpc.simulator.pause.useMutation()
  const resume = trpc.simulator.resume.useMutation()
  const setSimSpeed = trpc.simulator.setSpeed.useMutation()

  const severityColor: Record<string, string> = {
    critical: 'red', warning: 'orange', info: 'blue',
  }

  if (!wardReady) {
    return (
      <Container size="xl" py="xl">
        <Loader />
        <Text mt="md">正在创建虚拟病房...</Text>
      </Container>
    )
  }

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={3}>IOMTea 监护面板</Title>
        <Group>
          <Badge color="green" size="lg">病房运行中</Badge>
          <Button size="xs" variant="outline" onClick={() => {
            pause.mutate({ wardId: wardId! })
          }}>暂停</Button>
          <Button size="xs" variant="outline" onClick={() => {
            resume.mutate({ wardId: wardId! })
          }}>恢复</Button>
          <Button size="xs" variant="subtle" color="red" onClick={logout}>退出</Button>
        </Group>
      </Group>

      <Grid>
        <Grid.Col span={8}>
          <Title order={5} mb="sm">患者监护</Title>
          <Grid>
            {[
              { name: '张三', age: 72, bed: 'A1' },
              { name: '李四', age: 68, bed: 'A2' },
              { name: '王五', age: 75, bed: 'A3' },
            ].map((info, i) => {
              const query = latestQueries[i]
              const vitals = query?.data || []

              const getVital = (metric: string) =>
                vitals.find((v: any) => v.metric === metric)

              const hr = getVital('heart_rate')
              const rr = getVital('resp_rate')
              const spo2 = getVital('spo2')
              const temp = getVital('temperature')

              return (
                <Grid.Col span={4} key={i}>
                  <Card shadow="sm" padding="md" radius="md" withBorder>
                    <Group justify="space-between" mb="xs">
                      <Text fw={700}>{info.name}</Text>
                      <Badge size="sm" variant="light">{info.bed}</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">{info.age}岁 · 老年心血管</Text>

                    <Paper bg="gray.0" p="sm" mt="sm" radius="md">
                      <Grid>
                        <Grid.Col span={6}>
                          <Stack gap={0}>
                            <Text size="xs" c="dimmed">心率</Text>
                            <Text size="xl" fw={700} c={hr?.value != null && hr.value > 120 ? 'red' : 'green'}>
                              {hr?.value != null ? `${hr.value}` : '--'}
                              <Text component="span" size="sm" fw={400}> bpm</Text>
                            </Text>
                          </Stack>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Stack gap={0}>
                            <Text size="xs" c="dimmed">呼吸率</Text>
                            <Text size="xl" fw={700} c="blue">
                              {rr?.value != null ? `${rr.value}` : '--'}
                              <Text component="span" size="sm" fw={400}> rpm</Text>
                            </Text>
                          </Stack>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Stack gap={0}>
                            <Text size="xs" c="dimmed">血氧</Text>
                            <Text size="xl" fw={700} c={spo2?.value != null && spo2.value < 92 ? 'red' : 'green'}>
                              {spo2?.value != null ? `${spo2.value}` : '--'}
                              <Text component="span" size="sm" fw={400}> %</Text>
                            </Text>
                          </Stack>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Stack gap={0}>
                            <Text size="xs" c="dimmed">体温</Text>
                            <Text size="xl" fw={700}>
                              {temp?.value != null ? `${temp.value}` : '--'}
                              <Text component="span" size="sm" fw={400}> °C</Text>
                            </Text>
                          </Stack>
                        </Grid.Col>
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
          <Paper p="sm" withBorder style={{ maxHeight: 500, overflow: 'auto' }}>
            {alerts.data?.length === 0 && (
              <Text size="sm" c="dimmed" ta="center" py="xl">无活跃告警</Text>
            )}
            {alerts.data?.map((a: any) => (
              <Paper key={a.id} p="xs" mb="xs" bg={`${severityColor[a.severity]}.0`} radius="sm">
                <Group gap={4}>
                  <Badge size="xs" color={severityColor[a.severity]}>{a.severity}</Badge>
                  <Text size="xs">{a.metric}</Text>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  {new Date(a.recordedAt).toLocaleTimeString()}
                  {a.status === 'active' && ' · 未处理'}
                  {a.status === 'acknowledged' && ' · 已确认'}
                </Text>
              </Paper>
            ))}
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  )
}

export function App() {
  const token = useAuthStore((s) => s.token)
  return token ? <Dashboard /> : <LoginPage />
}
