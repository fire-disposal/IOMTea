import { ActionIcon, AppShell, Badge, Burger, Container, Group, Loader, NavLink, ScrollArea, Stack, Text, ThemeIcon } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconAlertTriangle, IconChartLine, IconCube, IconDashboard, IconDeviceDesktop, IconMap, IconSettings, IconStethoscope, IconUsers } from '@tabler/icons-react'
import { useState } from 'react'
import { LoginPage } from './LoginPage'
import { StoreProvider } from './StoreProvider'
import { AlertRulesPage } from './pages/AlertRulesPage'
import { AssetManagerPage } from './pages/AssetManagerPage'
import { DashboardOverview } from './pages/DashboardOverview'
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
  const wardRunning = useWardStore((s) => s.wardRunning)
  const wsConnected = useWardStore((s) => s.wsConnected)
  const [active, setActive] = useState('dashboard')
  const [opened, { toggle }] = useDisclosure()

  const alertCount = trpc.alert.list.useQuery({ pageSize: 1, status: 'active' }, { refetchInterval: 10000 })

  if (patientsLoading) {
    return <Container py="xl"><Stack align="center" gap="md"><Loader /><Text c="dimmed">加载系统数据...</Text></Stack></Container>
  }

  const navItems = [
    { value: 'dashboard', label: '系统概览', icon: IconDashboard },
    { value: 'trends', label: '趋势分析', icon: IconChartLine },
    { value: 'digitaltwin', label: '数字孪生', icon: IconCube },
    { value: 'patients', label: '患者管理', icon: IconUsers },
    { value: 'devices', label: '设备管理', icon: IconDeviceDesktop },
    { value: 'alertRules', label: '告警阈值', icon: IconAlertTriangle, alert: alertCount.data?.length },
    { value: 'wards', label: 'Ward 管理', icon: IconStethoscope },
    { value: 'mapEditor', label: '地图编辑', icon: IconMap },
    { value: 'assets', label: '资产管理', icon: IconSettings },
  ]

  return (
    <>
      <StoreProvider />
      <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding={0}>
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="sm">
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <ThemeIcon size="sm" radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>🏥</ThemeIcon>
              <Text fw={700}>IOMTea</Text>
              <Badge color={wardRunning ? 'green' : 'gray'} size="sm" variant="dot">{wardRunning ? '运行中' : '已暂停'}</Badge>
              <Badge color={wsConnected ? 'green' : 'orange'} size="sm" variant="light">{wsConnected ? '实时' : '轮询'}</Badge>
            </Group>
            <ActionIcon variant="subtle" color="red" onClick={logout} aria-label="退出" size="md"><IconUsers size={18} /></ActionIcon>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
          <Stack gap={0} style={{ height: '100%' }}>
            <ScrollArea style={{ flex: 1 }} scrollbarSize={6}>
              <Stack gap={2}>
                {navItems.map((item) => (
                  <NavLink
                    key={item.value}
                    label={item.label}
                    leftSection={<item.icon size={20} />}
                    rightSection={item.alert ? <Badge size="xs" color="red" variant="filled">{item.alert}</Badge> : undefined}
                    active={active === item.value}
                    onClick={() => { setActive(item.value); toggle() }}
                    variant="light"
                    style={{ borderRadius: 6 }}
                  />
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        </AppShell.Navbar>

        <AppShell.Main>
          {active === 'dashboard' && <DashboardOverview />}
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
