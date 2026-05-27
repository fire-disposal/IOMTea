import {
  ActionIcon,
  Button,
  Container,
  Group,
  Select,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useDelete, useGet, usePost } from '../api/hooks'
import { StateEmpty, StateSkeleton } from '../components/StateComponents'
import { parsePatientId } from '../lib/path'

const PATIENT_RELATIONS = [
  'primary', 'spouse', 'child', 'parent', 'sibling',
  'caregiver', 'doctor', 'nurse', 'admin', 'other',
] as const

interface LinkedUser {
  userId: string
  username?: string
  displayName?: string
  role?: string
  relation?: string | null
}

export function PatientUsers() {
  const pid = parsePatientId()
  const { data: linked, isLoading } = useGet<LinkedUser[]>(`/patients/${pid}/users`)
  const { data: allUsers } =
    useGet<{ id: string; displayName: string; username: string }[]>('/users')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [relation, setRelation] = useState<string | null>('caregiver')

  const addLink = usePost(`/patients/${pid}/users`, [`patients/${pid}/users`])
  const removeLink = useDelete(`/patients/${pid}/users/:userId`, [`patients/${pid}/users`])

  const availableUsers = (allUsers || []).filter(
    (u) => !(linked || []).some((l) => l.userId === u.id),
  )

  if (isLoading) return <StateSkeleton lines={4} />

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
        <Select
          size="xs"
          placeholder="关系类型"
          data={PATIENT_RELATIONS.map((r) => ({ value: r, label: r }))}
          value={relation}
          onChange={setRelation}
          w={140}
        />
        <Button
          size="xs"
          leftSection={<IconPlus size={12} />}
          onClick={() => {
            if (!selectedUser) return
            addLink.mutate(
              { userId: selectedUser, relation: relation ?? undefined },
              { onSuccess: () => { setSelectedUser(null); setRelation('caregiver') } },
            )
          }}
          disabled={!selectedUser}
        >
          关联
        </Button>
      </Group>
      {!linked || linked.length === 0 ? (
        <StateEmpty message="暂无关联用户" />
      ) : (
        <Table striped stickyHeader highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>用户名</Table.Th>
              <Table.Th>显示名</Table.Th>
              <Table.Th>角色</Table.Th>
              <Table.Th>关系</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(linked || []).map((l) => (
              <Table.Tr key={l.userId}>
                <Table.Td>{l.username}</Table.Td>
                <Table.Td>{l.displayName || '-'}</Table.Td>
                <Table.Td>{l.role}</Table.Td>
                <Table.Td>{l.relation || '-'}</Table.Td>
                <Table.Td>
                  <Tooltip label="取消关联" withArrow>
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => removeLink.mutate(l.userId)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Container>
  )
}
