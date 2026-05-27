import { Badge, Container, Group, Paper, Table, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconShield } from '@tabler/icons-react'
import { useGet, usePatch } from '../api/hooks'
import { RoleSelect } from '../components/RoleSelect'
import { StateSkeleton } from '../components/StateComponents'

interface User {
  id: string
  username: string
  displayName: string | null
  role: string
  status: string
  credit: number
}

export function RbacManagementPage() {
  const { data: users, isLoading } = useGet<User[]>('/users')
  const patchRole = usePatch<unknown, { role: string }>('/users/:id/role')

  const handleRoleChange = (userId: string, newRole: string) => {
    patchRole.mutate(
      { id: userId, role: newRole },
      {
        onSuccess: () =>
          notifications.show({ title: '角色已更新', message: `用户角色已更新为 ${newRole}`, color: 'green' }),
        onError: () =>
          notifications.show({ title: '更新失败', message: '角色更新失败', color: 'red' }),
      },
    )
  }

  if (isLoading) return <StateSkeleton lines={4} />

  return (
    <Container py="md">
      <Group mb="md">
        <IconShield size={28} />
        <Title order={2}>权限管理</Title>
      </Group>

      <Paper p="md" withBorder>
        <Text size="sm" c="dimmed" mb="md">
          管理用户角色分配。角色决定用户在后端 API 中的访问权限。
        </Text>

        <Table striped stickyHeader highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>用户名</Table.Th>
              <Table.Th>显示名</Table.Th>
              <Table.Th>状态</Table.Th>
              <Table.Th>角色</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(users ?? []).map((u) => (
              <Table.Tr key={u.id}>
                <Table.Td>{u.username}</Table.Td>
                <Table.Td>{u.displayName ?? '-'}</Table.Td>
                <Table.Td>
                  <Badge color={u.status === 'active' ? 'green' : 'red'} variant="light">
                    {u.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <RoleSelect value={u.role} onChange={(v) => handleRoleChange(u.id, v)} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Container>
  )
}
