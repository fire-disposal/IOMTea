import {
  ActionIcon,
  AppShell,
  Burger,
  Button,
  Divider,
  Group,
  Modal,
  NavLink,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconAlertTriangle,
  IconBell,
  IconCalendar,
  IconChartLine,
  IconDashboard,
  IconLogout,
  IconPill,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react'
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { StoreProvider } from './StoreProvider'
import { AlertBoard } from './pages/AlertBoard'
import { DashboardPage } from './pages/DashboardPage'
import { DeviceListPage } from './pages/DeviceListPage'
import { GlobalAppointments } from './pages/GlobalAppointments'
import { GlobalMedications } from './pages/GlobalMedications'
import { HomeMapViewerPage } from './pages/HomeMapViewerPage'
import { PatientAlerts } from './pages/PatientAlerts'
import { PatientAppointments } from './pages/PatientAppointments'
import { PatientDetailShell } from './pages/PatientDetailShell'
import { PatientMedications } from './pages/PatientMedications'
import { PatientOverview } from './pages/PatientOverview'
import { PatientProfile } from './pages/PatientProfile'
import { PatientWall } from './pages/PatientWall'
import { PinManagementPage } from './pages/PinManagementPage'
import { TrendsPage } from './pages/TrendsPage'
import { useAuthStore } from './store/auth'
import { MapEditorPage } from './twin/Editor/MapEditorPage'

const navItems = [
  { label: '工作台', icon: IconDashboard, path: '/' },
  { label: '居民管理', icon: IconUsers, path: '/residents' },
  { label: '健康趋势', icon: IconChartLine, path: '/trends' },
  { label: '异常处置', icon: IconBell, path: '/alerts' },
  { label: '随访管理', icon: IconCalendar, path: '/appointments' },
  { label: '用药监督', icon: IconPill, path: '/medications' },
  { label: 'IoT 配置', icon: IconSettings, path: '/iot/pins' },
]

const pageStyles = [
  '@keyframes pageFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
  '.page-fade-in{animation:pageFadeIn .2s ease-out}',
  '.card-hover{transition:transform .2s ease,box-shadow .2s ease}',
  '.card-hover:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.08)}',
  '.alert-card{transition:transform .15s ease,box-shadow .15s ease}',
  '.alert-card:hover{transform:translateX(3px)}',
].join('')

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function DashboardLayout() {
  const [opened, { toggle }] = useDisclosure()
  const [logoutModal, { open: openLogoutModal, close: closeLogoutModal }] = useDisclosure()
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const role = useAuthStore((s) => s.role)
  const isAdmin = role === 'admin'

  const currentPage = navItems.find((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
  )

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
            <ThemeIcon
              size="lg"
              radius="md"
              variant="gradient"
              gradient={{ from: 'matchaGreen', to: '#8EC15B' }}
            >
              <Text size="lg">🍵</Text>
            </ThemeIcon>
            <Text fw={700} size="lg">
              IOMTea
            </Text>
            <Text size="sm" c="dimmed" visibleFrom="sm">
              / {currentPage?.label ?? ''}
            </Text>
          </Group>
          <ActionIcon variant="subtle" color="red" onClick={openLogoutModal}>
            <IconLogout size={18} />
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            label={item.label}
            leftSection={<item.icon size={20} stroke={1.5} />}
            active={
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)
            }
            onClick={() => navigate(item.path)}
            variant="light"
            mb={2}
          />
        ))}
        <Divider my="sm" />
        {isAdmin && (
          <NavLink
            label="系统设置"
            leftSection={<IconSettings size={20} stroke={1.5} />}
            active={location.pathname.startsWith('/settings')}
            onClick={() => navigate('/settings')}
            variant="light"
          />
        )}
      </AppShell.Navbar>

      <AppShell.Main>
        <style>{pageStyles}</style>
        <StoreProvider />
        <div key={location.pathname} className="page-fade-in">
          <Outlet />
        </div>
      </AppShell.Main>
      <Modal opened={logoutModal} onClose={closeLogoutModal} title="确认退出" size="sm">
        <Text mb="lg">确定要退出登录吗？</Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={closeLogoutModal}>
            取消
          </Button>
          <Button
            color="red"
            onClick={() => {
              logout()
              closeLogoutModal()
            }}
          >
            确认退出
          </Button>
        </Group>
      </Modal>
    </AppShell>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="patients" element={<PatientWall />} />
          <Route path="residents" element={<PatientWall />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="patients/:id" element={<PatientDetailShell />}>
            <Route index element={<PatientOverview />} />
            <Route path="alerts" element={<PatientAlerts />} />
            <Route path="medications" element={<PatientMedications />} />
            <Route path="appointments" element={<PatientAppointments />} />
            <Route path="profile" element={<PatientProfile />} />
            <Route path="map-editor" element={<MapEditorPage />} />
          </Route>
          <Route path="patients/:id/map" element={<HomeMapViewerPage />} />
          <Route path="alerts" element={<AlertBoard />} />
          <Route path="medications" element={<GlobalMedications />} />
          <Route path="appointments" element={<GlobalAppointments />} />
          <Route path="iot/pins" element={<PinManagementPage />} />
          <Route path="settings" element={<DeviceListPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
