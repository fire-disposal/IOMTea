import {
  ActionIcon,
  AppShell,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Loader,
  NavLink,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'
import { LoginPage } from './LoginPage'
import { StoreProvider } from './StoreProvider'
import { AlertRulesPage } from './pages/AlertRulesPage'
import { AssetManagerPage } from './pages/AssetManagerPage'
import { DeviceListPage } from './pages/DeviceListPage'
import { DigitalTwinPage } from './pages/DigitalTwinPage'
import { MapEditorPage } from './map/editor/MapEditorPage'
import { PatientListPage } from './pages/PatientListPage'
import { TrendsPage } from './pages/TrendsPage'
import { WardManagementPage } from './pages/WardManagementPage'
import { useAuthStore } from './store/auth'
import { usePatientStore } from './store/patients'
import { useWardStore } from './store/ward'
import { trpc } from './trpc'

function Dashboard() {
  const logout = useAuthStore((s) => s.logout)
  const patients = usePatientStore((s) => s.patients)
  const patientsLoading = usePatientStore((s) => s.isLoading)
  const wardId = useWardStore((s) => s.selectedWardId)
  const wardRunning = useWardStore((s) => s.wardRunning)
  const wsConnected = useWardStore((s) => s.wsConnected)
  const [active, setActive] = useState('dashboard')
  const [selectedMetric, setSelectedMetric] = useState('standard')
  const [opened, { toggle }] = useDisclosure()

  const patientIds = patients.map((p) => p.id)
  const patientNames = patients.map((p) => p.name)

  const alertCount = trpc.alert.list.useQuery(
    { pageSize: 1, status: 'active' },
    { refetchInterval: 10000 },
  )

  const inject = trpc.simulator.injectScenario.useMutation({
    onSuccess: () =>
      notifications.show({ title: '场景已注入', message: '查看告警面板', color: 'orange' }),
    onError: (err: any) =>
      notifications.show({ title: '注入失败', message: err.message, color: 'red' }),
  })

  const latestQueries = patientIds.slice(0, 3).map((id) =>
    trpc.data.latest.useQuery(
      { patientId: id },
      { enabled: !!id, refetchInterval: 15000 },
    ),
  )

  const hasError = latestQueries.some((q) => q.isError)

  const alerts = trpc.alert.list.useQuery(
    { pageSize: 15, status: 'active' },
    { refetchInterval: 10000 },
  )
  const pause = trpc.simulator.pause.useMutation({
    onSuccess: () => notifications.show({ title: '已暂停', message: '', color: 'blue' }),
    onError: (err: any) =>
      notifications.show({ title: '暂停失败', message: err.message, color: 'red' }),
  })
  const resume = trpc.simulator.resume.useMutation({
    onSuccess: () => notifications.show({ title: '已恢复', message: '', color: 'green' }),
    onError: (err: any) =>
      notifications.show({ title: '恢复失败', message: err.message, color: 'red' }),
  })

  const severityColor: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' }

  if (patientsLoading) {
    return (
      <Container py="xl">
        <Stack align="center" gap="md">
          <Loader />
          <Text c="dimmed">加载患者数据...</Text>
        </Stack>
      </Container>
    )
  }
  if (hasError) {
    return (
      <Container py="xl" ta="center">
        <Text c="red" fw={500}>数据获取失败</Text>
        <Text size="sm" c="dimmed" mt="xs">请检查网络连接后刷新页面</Text>
      </Container>
    )
  }
  if (patientNames.length === 0) {
    return (
      <Container py="xl" ta="center">
        <Text c="dimmed" mb="md">暂无患者数据</Text>
        <Text size="sm" c="dimmed" mb="lg">通过左侧导航前往"Ward 管理"创建仿真 Ward，或前往"患者管理"手动添加患者</Text>
        <Group justify="center" gap="sm">
          <Button variant="light" onClick={() => setActive('wards')}>Ward 管理</Button>
          <Button variant="light" onClick={() => setActive('patients')}>患者管理</Button>
        </Group>
      </Container>
    )
  }

  const injectActions = [
    { label: '离床', type: 'bed_exit' as const, color: 'orange' },
    { label: '心动过速', type: 'tachycardia' as const, color: 'red' },
    { label: '跌倒', type: 'fall' as const, color: 'red' },
    { label: '低血氧', type: 'low_spo2' as const, color: 'red' },
    { label: '高血糖', type: 'hyperglycemia' as const, color: 'orange' },
    { label: '低血糖', type: 'hypoglycemia' as const, color: 'red' },
    { label: '低血压', type: 'hypotension' as const, color: 'orange' },
    { label: '心律失常', type: 'arrhythmia' as const, color: 'red' },
    { label: '呼吸窘迫', type: 'respiratory_distress' as const, color: 'red' },
  ]

  const dashboardView = (
    <Container size="xl" py="md">
      {/* Control bar */}
      <Group justify="space-between" mb="md">
        <Group>
          <Badge color={wardRunning ? 'green' : 'gray'} size="lg" variant="filled">
            {wardRunning ? '● 运行中' : '○ 已暂停'}
          </Badge>
          <Badge color={wsConnected ? 'green' : 'orange'} size="sm" variant="light">
            {wsConnected ? '实时' : '轮询'}
          </Badge>
        </Group>
        <Group gap="xs">
          {wardRunning ? (
            <Button
              size="xs"
              variant="light"
              color="orange"
              onClick={() => pause.mutate({ wardId })}
            >
              暂停仿真
            </Button>
          ) : (
            <Button
              size="xs"
              variant="light"
              color="green"
              onClick={() => resume.mutate({ wardId })}
            >
              恢复仿真
            </Button>
          )}
        </Group>
      </Group>

      {/* Inject scenario buttons */}
      <Group mb="md" gap="xs">
        <Text size="xs" fw={600} c="dimmed">
          指标切换:
        </Text>
        <SegmentedControl
          aria-label="选择监护指标"
          value={selectedMetric}
          onChange={(v) => setSelectedMetric(v)}
          data={[
            { value: 'standard', label: '基础' },
            { value: 'bp', label: '血压' },
            { value: 'glucose', label: '血糖' },
            { value: 'motion', label: '体动' },
          ]}
          size="xs"
        />
      </Group>

      <Paper p="sm" mb="md" withBorder bg="gray.0">
        <Group gap="xs">
          <Text size="xs" fw={600} c="dimmed">
            演示注入:
          </Text>
          {injectActions.map((a) => (
            <Button
              key={a.type}
              size="xs"
              variant="filled"
              color={a.color}
              loading={inject.isPending}
              onClick={() => inject.mutate({ wardId, type: a.type })}
            >
              {a.label}
            </Button>
          ))}
        </Group>
      </Paper>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Title order={5} mb="sm">
            患者监护
          </Title>
          <Grid>
            {patientNames.map((name, i) => {
              const query = latestQueries[i]
              const vitals = query?.data || []
              const gv = (m: string) => vitals.find((v: any) => v.metric === m)
              const hr = gv('heart_rate'),
                rr = gv('resp_rate'),
                spo2 = gv('spo2'),
                temp = gv('temperature')

              if (query?.isLoading) {
                return (
                  <Grid.Col span={{ base: 12, sm: 6, lg: 4 }} key={i}>
                    <Skeleton height={340} radius="md" />
                  </Grid.Col>
                )
              }

              return (
                <Grid.Col span={{ base: 12, sm: 6, lg: 4 }} key={i}>
                  <Card shadow="sm" padding="md" radius="md" withBorder>
                    <Group justify="space-between" mb="xs">
                      <Text fw={700}>{name}</Text>
                      <Badge size="xs" variant="dot" color="green">
                        在线
                      </Badge>
                      {(() => {
                        const posture = vitals.find((v: any) => v.metric === 'posture')
                        const p = (posture?.tags?.posture as string) || 'unknown'
                        const postureLabels: Record<string, string> = {
                          lying: '躺卧',
                          sitting: '坐姿',
                          standing: '站立',
                          walking: '行走',
                        }
                        return (
                          <Badge size="xs" variant="light" color="blue">
                            {postureLabels[p] || p}
                          </Badge>
                        )
                      })()}
                    </Group>
                    <Paper bg="gray.0" p="sm" radius="md">
                      <Grid>
                        <Grid.Col span={6}>
                          <Stack gap={0}>
                            <Text size="xs" c="dimmed">
                              心率
                            </Text>
                            <Text
                              size="xl"
                              fw={700}
                              c={
                                hr && hr.value != null && hr.value > 120
                                  ? 'red'
                                  : hr && hr.value != null && hr.value < 50
                                    ? 'orange'
                                    : 'green'
                              }
                            >
                              {hr && hr.value != null ? `${hr.value}` : '--'}
                              <Text component="span" size="sm" fw={400}>
                                {' '}
                                bpm
                              </Text>
                            </Text>
                          </Stack>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Stack gap={0}>
                            <Text size="xs" c="dimmed">
                              呼吸率
                            </Text>
                            <Text size="xl" fw={700} c="blue">
                              {rr && rr.value != null ? `${rr.value}` : '--'}
                              <Text component="span" size="sm" fw={400}>
                                {' '}
                                rpm
                              </Text>
                            </Text>
                          </Stack>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Stack gap={0}>
                            <Text size="xs" c="dimmed">
                              血氧
                            </Text>
                            <Text
                              size="xl"
                              fw={700}
                              c={spo2 && spo2.value != null && spo2.value < 92 ? 'red' : 'green'}
                            >
                              {spo2 && spo2.value != null ? `${spo2.value}` : '--'}
                              <Text component="span" size="sm" fw={400}>
                                {' '}
                                %
                              </Text>
                            </Text>
                          </Stack>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Stack gap={0}>
                            <Text size="xs" c="dimmed">
                              体温
                            </Text>
                            <Text size="xl" fw={700}>
                              {temp && temp.value != null ? `${temp.value}` : '--'}
                              <Text component="span" size="sm" fw={400}>
                                {' '}
                                °C
                              </Text>
                            </Text>
                          </Stack>
                        </Grid.Col>
                      </Grid>
                      {selectedMetric === 'bp' &&
                        (() => {
                          const sys = gv('systolic_bp'),
                            dia = gv('diastolic_bp')
                          return (
                            <Grid mt="xs">
                              <Grid.Col span={6}>
                                <Stack gap={0}>
                                  <Text size="xs" c="dimmed">
                                    收缩压
                                  </Text>
                                  <Text
                                    size="xl"
                                    fw={700}
                                    c={
                                      sys && sys.value != null && (sys.value as number) > 150
                                        ? 'red'
                                        : 'green'
                                    }
                                  >
                                    {sys && sys.value != null ? `${sys.value}` : '--'}
                                    <Text component="span" size="sm" fw={400}>
                                      {' '}
                                      mmHg
                                    </Text>
                                  </Text>
                                </Stack>
                              </Grid.Col>
                              <Grid.Col span={6}>
                                <Stack gap={0}>
                                  <Text size="xs" c="dimmed">
                                    舒张压
                                  </Text>
                                  <Text
                                    size="xl"
                                    fw={700}
                                    c={
                                      dia && dia.value != null && (dia.value as number) > 100
                                        ? 'red'
                                        : 'green'
                                    }
                                  >
                                    {dia && dia.value != null ? `${dia.value}` : '--'}
                                    <Text component="span" size="sm" fw={400}>
                                      {' '}
                                      mmHg
                                    </Text>
                                  </Text>
                                </Stack>
                              </Grid.Col>
                            </Grid>
                          )
                        })()}
                      {selectedMetric === 'glucose' &&
                        (() => {
                          const glu = gv('glucose')
                          const val = glu?.value as number | undefined
                          const color =
                            val != null
                              ? val > 11 || val < 3.5
                                ? 'red'
                                : val > 8
                                  ? 'orange'
                                  : 'green'
                              : undefined
                          return (
                            <Grid mt="xs">
                              <Grid.Col span={12}>
                                <Stack gap={0}>
                                  <Text size="xs" c="dimmed">
                                    血糖
                                  </Text>
                                  <Text size="xl" fw={700} c={color}>
                                    {val != null ? val : '--'}
                                    <Text component="span" size="sm" fw={400}>
                                      {' '}
                                      mmol/L
                                    </Text>
                                  </Text>
                                </Stack>
                              </Grid.Col>
                            </Grid>
                          )
                        })()}
                      {selectedMetric === 'motion' &&
                        (() => {
                          const mot = gv('motion_index')
                          const val = mot?.value as number | undefined
                          return (
                            <Grid mt="xs">
                              <Grid.Col span={12}>
                                <Stack gap={0}>
                                  <Text size="xs" c="dimmed">
                                    体动指数
                                  </Text>
                                  <Text
                                    size="xl"
                                    fw={700}
                                    c={val != null && val > 0.2 ? 'orange' : 'green'}
                                  >
                                    {val != null ? val : '--'}
                                    <Text component="span" size="sm" fw={400}>
                                      {' '}
                                      g
                                    </Text>
                                  </Text>
                                </Stack>
                              </Grid.Col>
                            </Grid>
                          )
                        })()}
                    </Paper>
                  </Card>
                </Grid.Col>
              )
            })}
          </Grid>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Title order={5} mb="sm">
            告警时间线
          </Title>
          <Paper p="sm" withBorder style={{ maxHeight: 520, overflow: 'auto' }}>
            {(!alerts.data || alerts.data.length === 0) && (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                无活跃告警
              </Text>
            )}
            {alerts.data?.map((a: any) => (
              <Paper key={a.id} p="xs" mb="xs" bg={`${severityColor[a.severity]}.0`} radius="sm">
                <Group gap={4} wrap="nowrap">
                  <Badge size="xs" color={severityColor[a.severity]} variant="filled">
                    {a.severity}
                  </Badge>
                  <Text size="xs" fw={500}>
                    {a.tags?.message || a.metric}
                  </Text>
                </Group>
                <Group gap={8} mt={4}>
                  <Text size="xs" c="dimmed">
                    {new Date(a.recordedAt).toLocaleTimeString()}
                  </Text>
                  {a.value != null && (
                    <Text size="xs" c="dimmed">
                      值: {a.value}
                      {a.unit || ''}
                    </Text>
                  )}
                </Group>
              </Paper>
            ))}
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  )

  const navItems = [
    { value: 'dashboard', label: '监护面板', alert: alertCount.data?.length },
    { value: 'trends', label: '趋势分析' },
    { value: 'digitaltwin', label: '数字孪生' },
    { value: 'patients', label: '患者管理' },
    { value: 'devices', label: '设备管理' },
    { value: 'alertRules', label: '告警阈值' },
    { value: 'wards', label: 'Ward 管理' },
    { value: 'mapEditor', label: '地图编辑' },
    { value: 'assets', label: '资产管理' },
  ]

  return (
    <>
      <StoreProvider />
      <AppShell
        header={{ height: 50 }}
        navbar={{ width: 180, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        padding={0}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="xs">
              <ActionIcon variant="subtle" onClick={toggle} hiddenFrom="sm" aria-label="菜单">
                ☰
              </ActionIcon>
              <Text fw={700}>IOMTea</Text>
              <Badge color={wardRunning ? 'green' : 'gray'} size="sm" variant="dot">
                {wardRunning ? '运行中' : '暂停'}
              </Badge>
              <Badge color={wsConnected ? 'green' : 'orange'} size="sm" variant="light">
                {wsConnected ? '实时' : '轮询'}
              </Badge>
            </Group>
            <Button size="xs" variant="subtle" color="red" onClick={logout}>退出</Button>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="xs">
          {navItems.map((item) => (
            <NavLink
              key={item.value}
              label={item.label}
              active={active === item.value}
              onClick={() => { setActive(item.value); toggle() }}
              rightSection={
                item.alert != null && item.alert > 0 ? (
                  <Badge size="xs" color="red" variant="filled">{item.alert}</Badge>
                ) : undefined
              }
            />
          ))}
        </AppShell.Navbar>

        <AppShell.Main>
          {active === 'dashboard' && dashboardView}
          {active === 'trends' && <TrendsPage />}
          {active === 'patients' && <PatientListPage />}
          {active === 'devices' && <DeviceListPage />}
          {active === 'alertRules' && <AlertRulesPage />}
          {active === 'digitaltwin' && <DigitalTwinPage />}
          {active === 'mapEditor' && <MapEditorPage />}
          {active === 'wards' && <WardManagementPage />}
          {active === 'assets' && <AssetManagerPage />}
        </AppShell.Main>
      </AppShell>
    </>
  )
}

export function App() {
  const token = useAuthStore((s) => s.token)
  return token ? <Dashboard /> : <LoginPage />
}
