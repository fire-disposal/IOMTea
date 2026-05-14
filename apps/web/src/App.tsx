import { AppShell, Burger, Group, NavLink, Text, ThemeIcon, ActionIcon } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconDashboard, IconSettings, IconLogout, IconAlertTriangle, IconPill, IconCalendar } from '@tabler/icons-react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { PatientWall } from './pages/PatientWall'
import { PatientDetailShell } from './pages/PatientDetailShell'
import { PatientOverview } from './pages/PatientOverview'
import { PatientAlerts } from './pages/PatientAlerts'
import { PatientMedications } from './pages/PatientMedications'
import { PatientAppointments } from './pages/PatientAppointments'
import { PatientProfile } from './pages/PatientProfile'
import { DeviceListPage } from './pages/DeviceListPage'
import { GlobalAlerts } from './pages/GlobalAlerts'
import { GlobalMedications } from './pages/GlobalMedications'
import { GlobalAppointments } from './pages/GlobalAppointments'
import { MapEditorPage } from './map/editor/MapEditorPage'
import { StoreProvider } from './StoreProvider'
import { useAuthStore } from './store/auth'

const navItems = [
  { label: '患者监护', icon: IconDashboard, path: '/patients' },
  { label: '告警中心', icon: IconAlertTriangle, path: '/alerts' },
  { label: '用药管理', icon: IconPill, path: '/medications' },
  { label: '预约管理', icon: IconCalendar, path: '/appointments' },
]

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function DashboardLayout() {
  const [opened, { toggle }] = useDisclosure()
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const isAdmin = true

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'matchaGreen', to: '#8EC15B' }}>
              <Text size="lg">🍵</Text>
            </ThemeIcon>
            <Text fw={700} size="lg">IOMTea</Text>
          </Group>
          <ActionIcon variant="subtle" color="red" onClick={logout}>
            <IconLogout size={18} />
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            label={item.label}
            leftSection={<item.icon size={20} />}
            active={location.pathname.startsWith(item.path)}
            onClick={() => navigate(item.path)}
            variant="filled"
            style={{ borderRadius: 6 }}
          />
        ))}
        {isAdmin && (
          <NavLink
            label="系统设置"
            leftSection={<IconSettings size={20} />}
            active={location.pathname.startsWith('/settings')}
            onClick={() => navigate('/settings')}
            variant="filled"
            style={{ borderRadius: 6 }}
          />
        )}
      </AppShell.Navbar>

      <AppShell.Main>
        <StoreProvider />
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}

function SettingsLayout() {
  return <Outlet />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/patients" replace />} />
          <Route path="patients" element={<PatientWall />} />
          <Route path="patients/:id" element={<PatientDetailShell />}>
            <Route index element={<PatientOverview />} />
            <Route path="alerts" element={<PatientAlerts />} />
            <Route path="medications" element={<PatientMedications />} />
            <Route path="appointments" element={<PatientAppointments />} />
            <Route path="profile" element={<PatientProfile />} />
          </Route>
          <Route path="alerts" element={<GlobalAlerts />} />
          <Route path="medications" element={<GlobalMedications />} />
          <Route path="appointments" element={<GlobalAppointments />} />
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/map-editor" replace />} />
            <Route path="map-editor/:mapId?" element={<MapEditorPage />} />
            <Route path="devices" element={<DeviceListPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
