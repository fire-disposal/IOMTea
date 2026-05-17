import {
  AppShell, Burger, Divider, Group, NavLink, Text, ThemeIcon,
  ActionIcon, Modal, Button,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconDashboard, IconSettings, IconLogout, IconUsers,
  IconChartLine, IconBell, IconCalendar, IconPill,
} from '@tabler/icons-react'
import { Outlet, createFileRoute, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuthStore } from '../store/auth'
import { StoreProvider } from '../StoreProvider'

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

function DashboardLayout() {
  const [opened, { toggle }] = useDisclosure()
  const [logoutModal, { open: openLogoutModal, close: closeLogoutModal }] = useDisclosure()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useAuthStore((s) => s.logout)
  const role = useAuthStore((s) => s.role)
  const isAdmin = role === 'admin'
  const currentPage = navItems.find((item) => item.path === '/' ? pathname === '/' : pathname.startsWith(item.path))

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'matchaGreen', to: '#8EC15B' }}>
              <Text size="lg">🍵</Text>
            </ThemeIcon>
            <Text fw={700} size="lg">IOMTea</Text>
            <Text size="sm" c="dimmed" visibleFrom="sm">/ {currentPage?.label ?? ''}</Text>
          </Group>
          <ActionIcon variant="subtle" color="red" onClick={openLogoutModal}>
            <IconLogout size={18} />
          </ActionIcon>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        {navItems.map((item) => (
          <NavLink key={item.label} label={item.label}
            leftSection={<item.icon size={20} stroke={1.5} />}
            active={item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)}
            onClick={() => navigate({ to: item.path })} variant="light" mb={2}
          />
        ))}
        <Divider my="sm" />
        {isAdmin && (
          <NavLink label="系统设置"
            leftSection={<IconSettings size={20} stroke={1.5} />}
            active={pathname.startsWith('/settings')}
            onClick={() => navigate({ to: '/settings' })} variant="light"
          />
        )}
      </AppShell.Navbar>
      <AppShell.Main>
        <style>{pageStyles}</style>
        <StoreProvider />
        <div className="page-fade-in" style={{ minHeight: 'calc(100vh - 112px)' }}>
          <Outlet />
        </div>
      </AppShell.Main>
      <Modal opened={logoutModal} onClose={closeLogoutModal} title="确认退出" size="sm">
        <Text mb="lg">确定要退出登录吗？</Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={closeLogoutModal}>取消</Button>
          <Button color="red" onClick={() => { logout(); closeLogoutModal() }}>确认退出</Button>
        </Group>
      </Modal>
    </AppShell>
  )
}

export const Route = (createFileRoute as any)('/_auth')({
  beforeLoad: ({ location }: { location: { href: string } }) => {
    const token = useAuthStore.getState().token
    if (!token) throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: DashboardLayout,
})