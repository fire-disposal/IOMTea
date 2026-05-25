import { Container, Title, Group, Table, Badge, Button, ActionIcon, Modal, TextInput } from '@mantine/core'
import { IconTrash, IconPlus } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface Pin { pin: string; userId: string; type: string; label: string | null }

export function PinManagementPage() {
  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')

  const fetchPins = () => { http.get('/pins').then((r) => { setPins(r.data as Pin[]); setLoading(false) }) }
  useEffect(() => { fetchPins() }, [])

  const createPin = async () => {
    await http.post('/pins', { userId: 'dummy', type: 'virtual', label: newLabel } as any)
    setNewLabel('')
    fetchPins()
  }

  const revokePin = async (code: string) => {
    await http.delete('/pins/' + code)
    fetchPins()
  }

  if (loading) return <Container py="md"><Title order={2}>PIN 管理</Title><p>Loading...</p></Container>

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>PIN 管理</Title>
        <Group>
          <TextInput size="xs" placeholder="标签" value={newLabel} onChange={(e) => setNewLabel(e.currentTarget.value)} />
          <Button size="xs" leftSection={<IconPlus size={12} />} onClick={createPin}>新建</Button>
        </Group>
      </Group>
      <Table striped>
        <Table.Thead><Table.Tr>
          <Table.Th>PIN</Table.Th><Table.Th>类型</Table.Th><Table.Th>标签</Table.Th><Table.Th>操作</Table.Th>
        </Table.Tr></Table.Thead>
        <Table.Tbody>
          {pins.map((p) => (
            <Table.Tr key={p.pin}>
              <Table.Td><Badge variant="light">{p.pin}</Badge></Table.Td>
              <Table.Td>{p.type}</Table.Td>
              <Table.Td>{p.label ?? '-'}</Table.Td>
              <Table.Td><ActionIcon variant="light" color="red" onClick={() => revokePin(p.pin)}><IconTrash size={14} /></ActionIcon></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  )
}
