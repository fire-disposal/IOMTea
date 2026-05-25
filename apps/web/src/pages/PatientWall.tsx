import { ActionIcon, Badge, Container, Skeleton, Table, Title } from '@mantine/core'
import { IconEye } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { useGet } from '../api/hooks'

interface Patient {
  id: string
  name: string
  gender: string | null
  status: string
  phone: string | null
}

export function PatientWall() {
  const { data: patients, isLoading } = useGet<Patient[]>('/patients')
  const navigate = useNavigate()

  if (isLoading)
    return (
      <Container py="md">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={24} mb="sm" />
        ))}
      </Container>
    )

  return (
    <Container py="md">
      <Title order={2} mb="md">
        患者管理
      </Title>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>姓名</Table.Th>
            <Table.Th>性别</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(patients ?? []).map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>{p.name}</Table.Td>
              <Table.Td>{p.gender ?? '-'}</Table.Td>
              <Table.Td>
                <Badge size="xs">{p.status}</Badge>
              </Table.Td>
              <Table.Td>
                <ActionIcon variant="light" onClick={() => navigate({ to: '/patients/' + p.id })}>
                  <IconEye size={14} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  )
}
