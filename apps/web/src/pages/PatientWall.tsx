import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { IconEye, IconPlus } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useGet } from '../api/hooks'
import { BatchImportModal } from '../components/BatchImportModal'
import { StateSkeleton } from '../components/StateComponents'
import { TagFilter } from '../components/TagFilter'

interface Patient {
  id: string
  name: string
  gender: string | null
  status: string
  phone: string | null
  tags?: Record<string, unknown> | null
}

export function PatientWall() {
  const { data: patients, isLoading } = useGet<Patient[]>('/patients', { pageSize: 200 })
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const navigate = useNavigate()
  const { refetch } = useGet<Patient[]>('/patients', { pageSize: 200 })

  const filtered = (patients ?? []).filter((p) => {
    if (selectedTags.length === 0) return true
    const ptags = p.tags as Record<string, unknown> | null
    if (!ptags) return false
    return selectedTags.some((tag) =>
      Object.values(ptags).some((v) => String(v).toLowerCase().includes(tag.toLowerCase())),
    )
  })

  if (isLoading)
    return <StateSkeleton lines={5} />

  return (
    <Container py="md">
      <Title order={2} mb="md">
        患者管理
      </Title>
      <Group mb="md" justify="space-between">
        <TagFilter selected={selectedTags} onChange={setSelectedTags} />
        <Button size="xs" leftSection={<IconPlus size={12} />} onClick={() => setImportOpen(true)}>
          批量导入
        </Button>
      </Group>
      {filtered.length > 50 && (
        <Text size="xs" c="dimmed" mb="xs">
          显示前50条，共{filtered.length}条患者记录
        </Text>
      )}
      {filtered.length <= 50 && (
        <Text size="xs" c="dimmed" mb="xs">
          共{filtered.length}条患者记录
        </Text>
      )}
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>姓名</Table.Th>
            <Table.Th>性别</Table.Th>
            <Table.Th>标签</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filtered.slice(0, 50).map((p) => {
            const tags = p.tags ? Object.values(p.tags as object) : []
            return (
              <Table.Tr key={p.id}>
                <Table.Td>{p.name}</Table.Td>
                <Table.Td>{p.gender ?? '-'}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {(tags as string[]).slice(0, 3).map((t) => (
                      <Badge key={t} size="xs" variant="light">
                        {String(t)}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs">{p.status}</Badge>
                </Table.Td>
                <Table.Td>
                  <ActionIcon variant="light" onClick={() => navigate({ to: '/patients/' + p.id })}>
                    <IconEye size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
      <BatchImportModal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={refetch}
      />
    </Container>
  )
}
