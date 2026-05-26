import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Skeleton,
  Table,
  TextInput,
  Title,
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useDelete, useGet, usePost } from '../api/hooks'
import { useAuthStore } from '../store/auth'

interface Pin {
  pin: string
  userId: string
  type: string
  label: string | null
}

function getUserId(): string {
  const token = useAuthStore.getState().token
  if (!token) return ''
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub || ''
  } catch { return '' }
}

export function PinManagementPage() {
  const { data: pins, isLoading, refetch } = useGet<Pin[]>('/pins')
  const createPin = usePost('/pins', ['pins'])
  const deletePin = useDelete('/pins/:id', ['pins'])
  const [label, setLabel] = useState('')
  const userId = getUserId()

  if (isLoading)
    return (
      <Container py="md">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={24} mb="sm" />
        ))}
      </Container>
    )

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>PIN 管理</Title>
        <Group>
          <TextInput
            size="xs"
            placeholder="标签"
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
          />
          <Button
            size="xs"
            leftSection={<IconPlus size={12} />}
            onClick={() => {
              createPin.mutate({ userId, type: 'virtual', label: label || undefined } as any)
              setLabel('')
            }}
            disabled={!userId}
          >
            新建
          </Button>
        </Group>
      </Group>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>PIN</Table.Th>
            <Table.Th>类型</Table.Th>
            <Table.Th>标签</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(pins ?? []).map((p) => (
            <Table.Tr key={p.pin}>
              <Table.Td>
                <Badge variant="light">{p.pin}</Badge>
              </Table.Td>
              <Table.Td>{p.type}</Table.Td>
              <Table.Td>{p.label ?? '-'}</Table.Td>
              <Table.Td>
                <ActionIcon variant="light" color="red" onClick={() => deletePin.mutate(p.pin)}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  )
}
