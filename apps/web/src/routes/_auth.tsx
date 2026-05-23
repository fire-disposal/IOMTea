import {
  AppShell, Burger, Divider, Group, NavLink, Text, ThemeIcon,
  ActionIcon, Modal, Button,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconDashboard, IconSettings, IconLogout, IconUsers,
  IconChartLine, IconBell, IconPill, IconDevices, IconScreenShare, IconRobot,
  IconTopologyStar, IconMoodSmile,
} from '@tabler/icons-react'
import { Outlet, createFileRoute, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuthStore } from '../store/auth'
import { StoreProvider } from '../StoreProvider'

const monitorItems = [
  { label: '数据大屏', icon: IconScreenShare, path: '/data-dashboard' },
  { label: '工作台', icon: IconDashboard, path: '/' },
  { label: '居民管理', icon: IconUsers, path: '/patients' },
  { label: '健康趋势', icon: IconChartLine, path: '/trends' },
]

const manageItems = [
  { label: '用药监督', icon: IconPill, path: '/medications' },
  { label: '节点拓扑', icon: IconTopologyStar, path: '/node-graph' },
  { label: '捏脸工坊', icon: IconMoodSmile, path: '/avatar-editor' },
]

const adminItems = [
  { label: '虚拟PIN', icon: IconRobot, path: '/settings/virtual-pins' },
  { label: 'IoT 配置', icon: IconSettings, path: '/iot/pins' },
  { label: '系统设置', icon: IconDevices, path: '/settings' },
  { label: '用户管理', icon: IconSettings, path: '/settings/users' },
]

const pageStyles = [
  '@keyframes pageFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
  '.page-fade-in{animation:pageFadeIn .2s ease-out}',
  '.card-hover{transition:transform .2s ease,box-shadow .2s ease}',
  '.card-hover:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.08)}',
  '.card-hover:active{transform:translateY(0);box-shadow:0 2px 4px rgba(0,0,0,.04);transition:transform .05s}',
  '.alert-card{transition:transform .15s ease,box-shadow .15s ease}',
  '.alert-card:hover{transform:translateX(3px)}',
  '.anim-stagger-item{opacity:0;animation:fadeUp 0.3s ease-out forwards}',
  '@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
].join('')

function DashboardLayout() {
  const [opened, { toggle }] = useDisclosure()
  const [logoutModal, { open: openLogoutModal, close: closeLogoutModal }] = useDisclosure()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useAuthStore((s) => s.logout)
  const role = useAuthStore((s) => s.role)
  const isAdmin = role === 'admin'

  const allItems = [...monitorItems, ...manageItems, ...adminItems]
  const currentPage = allItems.find((item) => item.path === '/' ? pathname === '/' : pathname.startsWith(item.path))

  const isActive = (path: string) => path === '/' ? pathname === '/' : pathname.startsWith(path)

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
        <Text size="xs" c="dimmed" fw={500} px="sm" pt="xs" pb={4}>监控</Text>
        {monitorItems.map((item) => (
          <NavLink key={item.label} label={item.label}
            leftSection={<item.icon size={20} stroke={1.5} />}
            active={isActive(item.path)}
            onClick={() => navigate({ to: item.path })} variant="light" mb={2}
          />
        ))}
        <Divider my="xs" />
        <Text size="xs" c="dimmed" fw={500} px="sm" pt="xs" pb={4}>管理</Text>
        {manageItems.map((item) => (
          <NavLink key={item.label} label={item.label}
            leftSection={<item.icon size={20} stroke={1.5} />}
            active={isActive(item.path)}
            onClick={() => navigate({ to: item.path })} variant="light" mb={2}
          />
        ))}
        {isAdmin && (
          <>
            <Divider my="xs" />
            <Text size="xs" c="dimmed" fw={500} px="sm" pt="xs" pb={4}>系统</Text>
            {adminItems.map((item) => (
              <NavLink key={item.label} label={item.label}
                leftSection={<item.icon size={20} stroke={1.5} />}
                active={isActive(item.path)}
                onClick={() => navigate({ to: item.path })} variant="light" mb={2}
              />
            ))}
          </>
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