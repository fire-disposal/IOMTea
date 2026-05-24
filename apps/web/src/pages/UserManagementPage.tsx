import { Badge, Button, Container, Group, Modal, Paper, Select, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { trpc } from '../trpc'
import { DataTable } from '../components/shared/DataTable'
import type { UserRole } from '@iomtea/shared-types'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: '超级管理员' },
  { value: 'admin', label: '管理员' },
  { value: 'user', label: '用户' },
]

const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]))

function ActivationBadge({ lastLoginAt }: { lastLoginAt?: number | null }) {
  if (lastLoginAt) {
    return <Badge size="sm" color="teal" variant="dot">已激活 {new Date(lastLoginAt).toLocaleDateString('zh-CN')}</Badge>
  }
  return <Badge size="sm" color="gray" variant="dot">未激活</Badge>
}

export function UserManagementPage() {
  const utils = trpc.useUtils()
  const users = trpc.user.list.useQuery({ page: 1, pageSize: 100 })
  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      notifications.show({ title: '已更新', message: '', color: 'green' })
      utils.user.list.invalidate()
      setEditUser(null)
    },
    onError: (err) => notifications.show({ title: '更新失败', message: err.message, color: 'red' }),
  })

  const [editUser, setEditUser] = useState<{ id: string; displayName: string; role: UserRole } | null>(null)

  const columnHelper = createColumnHelper<any>()
  const columns = [
    columnHelper.accessor('username', { header: '用户名', cell: (info) => <Text fw={500}>{info.getValue()}</Text> }),
    columnHelper.accessor('displayName', { header: '显示名', cell: (info) => info.getValue() }),
    columnHelper.accessor('role', { header: '角色', cell: (info) => <Badge variant="light">{ROLE_LABELS[info.getValue()] || info.getValue()}</Badge> }),
    columnHelper.accessor('lastLoginAt', {
      header: '激活状态',
      cell: (info) => <ActivationBadge lastLoginAt={info.getValue() as number | null} />,
    }),
    columnHelper.accessor('createdAt', { header: '创建时间', cell: (info) => <Text size="sm">{new Date(info.getValue() as number).toLocaleDateString('zh-CN')}</Text> }),
    columnHelper.display({ id: 'actions', header: '操作',
      cell: (info) => (
        <Button size="xs" variant="light" onClick={() => setEditUser({ id: info.row.original.id, displayName: info.row.original.displayName, role: info.row.original.role })}>
          编辑
        </Button>
      ),
    }),
  ]

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>用户管理</Title>
        <Text size="sm" c="dimmed">仅管理员可管理用户角色</Text>
      </Group>

      <Paper p="lg" radius="md" withBorder>
        {users.isLoading && <Text c="dimmed" ta="center" py="xl">加载中...</Text>}
        {!users.isLoading && (users.data ?? []).length > 0 && (
          <DataTable data={users.data ?? []} columns={columns} />
        )}
      </Paper>

      <Modal opened={!!editUser} onClose={() => setEditUser(null)} title="编辑用户" size="sm">
        {editUser && (
          <>
            <Text mb="md">用户名: {editUser.displayName}</Text>
            <Select
              label="角色"
              data={ROLE_OPTIONS}
              value={editUser.role}
              onChange={(v) => v && setEditUser({ ...editUser, role: v as UserRole })}
              mb="lg"
            />
            <Button fullWidth onClick={() => updateMutation.mutate({ id: editUser.id, data: { role: editUser.role } })} loading={updateMutation.isPending}>
              保存
            </Button>
          </>
        )}
      </Modal>
    </Container>
  )
}