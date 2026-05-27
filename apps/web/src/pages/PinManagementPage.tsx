import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Table,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useDelete, useGet, usePost } from '../api/hooks'
import { StateSkeleton } from '../components/StateComponents'
import { confirmDelete } from '../lib/confirm-delete'
import { decodeJwtPayload } from '../store/auth'

interface Pin {
  pin: string
  userId: string
  type: string
  label: string | null
}

function getUserId(): string {
  const token = localStorage.getItem('token')
  if (!token) return ''
  const payload = token ? decodeJwtPayload(token) : null
  return payload?.sub || ''
}

export function PinManagementPage() {
  const { data: pins, isLoading } = useGet<Pin[]>('/pins')
  const createPin = usePost('/pins', ['pins'])
  const deletePin = useDelete('/pins/:id', ['pins'])
  const [label, setLabel] = useState('')
  const userId = getUserId()

  if (isLoading) return <StateSkeleton lines={3} />

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
              createPin.mutate({ userId, type: 'virtual', label: label || undefined })
              setLabel('')
            }}
            disabled={!userId}
          >
            新建
          </Button>
        </Group>
      </Group>
      <Table striped stickyHeader highlightOnHover>
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
                <Tooltip label="删除PIN" withArrow>
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() =>
                      confirmDelete(`确定要删除 PIN "${p.pin}" 吗？此操作不可撤销。`, () =>
                        deletePin.mutate(p.pin),
                      )
                    }
                  >
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
