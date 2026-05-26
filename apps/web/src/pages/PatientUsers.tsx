import { ActionIcon, Button, Container, Group, Select, Table, Text, Title, Tooltip } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'

function parseId() {
  return window.location.pathname.split('/patients/')[1]?.split('/')[0] || ''
}

export function PatientUsers() {
  const pid = parseId()
  const { data: linked, refetch } = useGet<any[]>(`/patients/${pid}/users`)
  const { data: allUsers } = useGet<any[]>('/users')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  const addLink = async () => {
    if (!selectedUser) return
    try {
      await http.post(`/patients/${pid}/users`, { userId: selectedUser })
      setSelectedUser(null)
      refetch()
    } catch {}
  }

  const removeLink = async (userId: string) => {
    try {
      await http.delete(`/patients/${pid}/users/${userId}`)
      refetch()
    } catch {}
  }

  const availableUsers = (allUsers || []).filter(
    (u) => !(linked || []).some((l) => l.userId === u.id),
  )

  return (
    <Container py="md">
      <Title order={3} mb="md">
        关联用户
      </Title>
      <Group mb="md">
        <Select
          size="xs"
          placeholder="选择用户"
          data={availableUsers.map((u) => ({ value: u.id, label: u.displayName || u.username }))}
          value={selectedUser}
          onChange={setSelectedUser}
          w={200}
        />
        <Button
          size="xs"
          leftSection={<IconPlus size={12} />}
          onClick={addLink}
          disabled={!selectedUser}
        >
          关联
        </Button>
      </Group>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>用户名</Table.Th>
            <Table.Th>显示名</Table.Th>
            <Table.Th>角色</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(linked || []).map((l: any) => (
            <Table.Tr key={l.userId}>
              <Table.Td>{l.username}</Table.Td>
              <Table.Td>{l.displayName || '-'}</Table.Td>
              <Table.Td>{l.role}</Table.Td>
              <Table.Td>
                <Tooltip label="取消关联" withArrow>
                  <ActionIcon variant="light" color="red" onClick={() => removeLink(l.userId)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  )
}
