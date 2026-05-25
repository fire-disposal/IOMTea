import { Button, Container, Group, Modal, Table, TextInput, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

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
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = () => {
    http.get('/users').then((res) => {
      setUsers(res.data as User[])
      setLoading(false)
    })
  }
  useEffect(() => {
    fetchUsers()
  }, [])

  if (loading)
    return (
      <Container py="md">
        <Title order={2}>用户管理</Title>
        <p>Loading...</p>
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
          {users.map((u) => (
            <Table.Tr key={u.id}>
              <Table.Td>{u.username}</Table.Td>
              <Table.Td>{u.displayName ?? '-'}</Table.Td>
              <Table.Td>{u.role}</Table.Td>
              <Table.Td>{u.status}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  )
}
