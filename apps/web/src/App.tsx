import { ActionIcon, AppShell, Badge, Button, Container, Group, Loader, NavLink, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
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

  const patientNames = patients.map((p) => p.name)
  const alertCount = trpc.alert.list.useQuery({ pageSize: 1, status: 'active' }, { refetchInterval: 10000 })

  if (patientsLoading) {
    return (
      <Container py="xl">
        <Stack align="center" gap="md"><Loader /><Text c="dimmed">加载系统数据...</Text></Stack>
      </Container>
    )
  }

  const navItems = [
    { value: 'dashboard', label: '系统概览', alert: alertCount.data?.length },
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
              <ActionIcon variant="subtle" onClick={toggle} hiddenFrom="sm" aria-label="菜单">☰</ActionIcon>
              <Text fw={700}>IOMTea</Text>
              <Badge color={wardRunning ? 'green' : 'gray'} size="sm" variant="dot">{wardRunning ? '运行' : '暂停'}</Badge>
              <Badge color={wsConnected ? 'green' : 'orange'} size="sm" variant="light">{wsConnected ? '实时' : '轮询'}</Badge>
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
              rightSection={item.alert ? <Badge size="xs" color="red" variant="filled">{item.alert}</Badge> : undefined}
            />
          ))}
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
