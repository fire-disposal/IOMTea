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
  IconDashboard,
  IconFileExport,
  IconFlask,
  IconKey,
  IconLogout,
  IconScreenShare,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'
import { Outlet, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuthStore } from '../store/auth'

interface NavItem {
  label: string
  icon: React.ElementType
  path: string
}

interface NavGroup {
  label: string
  items: NavItem[]
  roles: string[]
}

const navGroups: NavGroup[] = [
  {
    label: '监控',
    items: [
      { label: '数据大屏', icon: IconScreenShare, path: '/data-dashboard' },
      { label: '工作台', icon: IconDashboard, path: '/' },
      { label: '告警看板', icon: IconAlertTriangle, path: '/alerts' },
    ],
    roles: ['super_admin', 'admin', 'user'],
  },
  {
    label: '管理',
    items: [
      { label: '患者管理', icon: IconUsers, path: '/patients' },
      { label: '关系图谱', icon: IconFlask, path: '/node-graph' },
      { label: '数据导出', icon: IconFileExport, path: '/data-export' },
      { label: '模拟工厂', icon: IconFlask, path: '/simulation' },
    ],
    roles: ['super_admin', 'admin'],
  },
  {
    label: '设备与接入',
    items: [{ label: 'PIN 管理', icon: IconKey, path: '/iot/pins' }],
    roles: ['super_admin', 'admin'],
  },
  {
    label: '系统',
    items: [{ label: '用户管理', icon: IconUsersGroup, path: '/settings/users' }],
    roles: ['super_admin'],
  },
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

export function AuthLayout() {
  const [opened, { toggle }] = useDisclosure()
  const [logoutModal, { open: openLogoutModal, close: closeLogoutModal }] = useDisclosure()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useAuthStore((s) => s.logout)
  const role = useAuthStore((s) => s.role) ?? 'user'

  const visibleGroups = navGroups.filter((g) => g.roles.includes(role))
  const allVisibleItems = visibleGroups.flatMap((g) => g.items)
  const currentPage = allVisibleItems.find((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
  )

  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path))

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
        {visibleGroups.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <Divider my="xs" />}
            <Text size="xs" c="dimmed" fw={500} px="sm" pt="xs" pb={4}>
              {group.label}
            </Text>
            {group.items.map((item) => (
              <NavLink
                key={item.label}
                label={item.label}
                leftSection={<item.icon size={20} stroke={1.5} />}
                active={isActive(item.path)}
                onClick={() => navigate({ to: item.path })}
                variant="light"
                mb={2}
              />
            ))}
          </div>
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <style>{pageStyles}</style>
        <div className="page-fade-in" style={{ minHeight: 'calc(100vh - 112px)' }}>
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

export const authBeforeLoad = ({ location }: { location: { href: string } }) => {
  const state = useAuthStore.getState()
  if (!state.token) throw redirect({ to: '/login', search: { redirect: location.href } })

  const adminRoutes = ['/patients', '/medications', '/data-export', '/simulation', '/iot/pins']
  const superAdminRoutes = ['/settings/users']
  const pathname = location.href || ''

  if (superAdminRoutes.some((r) => pathname.startsWith(r)) && state.role !== 'super_admin') {
    throw redirect({ to: '/' })
  }
  if (adminRoutes.some((r) => pathname.startsWith(r))) {
    if (state.role !== 'admin' && state.role !== 'super_admin') {
      throw redirect({ to: '/' })
    }
  }
}
