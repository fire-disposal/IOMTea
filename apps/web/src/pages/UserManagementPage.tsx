import { Container, Select, Skeleton, Table, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useGet, usePatch } from '../api/hooks'

interface User {
  id: string
  username: string
  displayName: string | null
  role: string
  phone: string | null
  email: string | null
  status: string
}

export function UserManagementPage() {
  const { data: users, isLoading } = useGet<User[]>('/users')
  const patchRole = usePatch<unknown, { role: string }>('/users/:id/role')

  const handleRoleChange = (userId: string, newRole: string) => {
    patchRole.mutate(
      { id: userId, role: newRole },
      {
        onSuccess: () => notifications.show({ title: '角色已更新', message: `用户角色已更新为 ${newRole}`, color: 'green' }),
        onError: () => notifications.show({ title: '更新失败', message: '角色更新失败', color: 'red' }),
      }
    )
  }

  if (isLoading)
    return (
      <Container py="md">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={24} mb="sm" />
        ))}
      </Container>
    )

  return (
    <Container py="md">
      <Title order={2} mb="md">
        用户管理
      </Title>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>用户名</Table.Th>
            <Table.Th>显示名</Table.Th>
            <Table.Th>角色</Table.Th>
            <Table.Th>状态</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(users ?? []).map((u) => (
            <Table.Tr key={u.id}>
              <Table.Td>{u.username}</Table.Td>
              <Table.Td>{u.displayName ?? '-'}</Table.Td>
              <Table.Td>
                <Select
                  size="xs"
                  data={[
                    { value: 'super_admin', label: '超级管理员' },
                    { value: 'admin', label: '管理员' },
                    { value: 'user', label: '普通用户' },
                  ]}
                  value={u.role}
                  onChange={(v) => v && handleRoleChange(u.id, v)}
                  w={140}
                />
              </Table.Td>
              <Table.Td>{u.status}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  )
}
