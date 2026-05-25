import { Container, Title, Table, Badge, Group, Text, ActionIcon } from '@mantine/core'
import { IconEye } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { http } from '../api/client'
import { useNavigate } from '@tanstack/react-router'

interface Patient {
  id: string; name: string; gender: string | null; status: string
  phone: string | null; birthDate: string | null
}

export function PatientWall() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    http.get('/patients').then((res) => { setPatients(res.data as Patient[]); setLoading(false) })
  }, [])

  if (loading) return <Container py="md"><Title order={2}>患者管理</Title><p>Loading...</p></Container>

  return (
    <Container py="md">
      <Title order={2} mb="md">患者管理</Title>
      <Table striped>
        <Table.Thead><Table.Tr>
          <Table.Th>姓名</Table.Th><Table.Th>性别</Table.Th><Table.Th>状态</Table.Th><Table.Th>电话</Table.Th><Table.Th>操作</Table.Th>
        </Table.Tr></Table.Thead>
        <Table.Tbody>
          {patients.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>{p.name}</Table.Td>
              <Table.Td>{p.gender ?? '-'}</Table.Td>
              <Table.Td><Badge size="xs">{p.status}</Badge></Table.Td>
              <Table.Td>{p.phone ?? '-'}</Table.Td>
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
