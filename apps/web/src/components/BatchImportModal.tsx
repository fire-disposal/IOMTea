import { Modal, Textarea, Button, Table, Group, Text, Stack } from '@mantine/core'
import { useState } from 'react'
import { notifications } from '@mantine/notifications'
import { http } from '../api/client'

interface Props {
  opened: boolean
  onClose: () => void
  onSuccess: () => void
}

export function BatchImportModal({ opened, onClose, onSuccess }: Props) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<{ name: string; gender?: string }[]>([])
  const [loading, setLoading] = useState(false)

  const parseInput = () => {
    const lines = text.trim().split('\n').filter(Boolean)
    const parsed = lines.map((line) => {
      const parts = line.split(/[,;\t]+/)
      return { name: parts[0]?.trim() || '', gender: parts[1]?.trim() }
    }).filter((p) => p.name)
    setPreview(parsed)
  }

  const handleImport = async () => {
    setLoading(true)
    try {
      const res = await http.post('/patients/bulk', { patients: preview } as any)
      const data = res.data as { created: number; errors: string[] }
      notifications.show({
        title: `导入完成`,
        message: `成功 ${data.created} 条，失败 ${data.errors.length} 条`,
        color: data.errors.length ? 'yellow' : 'green',
      })
      onSuccess()
      onClose()
      setText('')
      setPreview([])
    } catch (e: any) {
      notifications.show({ title: '导入失败', message: e.message, color: 'red' })
    } finally { setLoading(false) }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="批量导入患者" size="lg">
      <Stack>
        <Text size="xs" c="dimmed">每行一个患者，格式: 姓名,性别</Text>
        <Textarea
          minRows={6}
          maxRows={10}
          placeholder="张三,male\n李四,female\n王五,male"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
        />
        <Group>
          <Button variant="light" onClick={parseInput}>解析预览</Button>
          <Button loading={loading} onClick={handleImport} disabled={preview.length === 0}>确认导入 ({preview.length} 条)</Button>
        </Group>
        {preview.length > 0 && (
          <Table striped>
            <Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>姓名</Table.Th><Table.Th>性别</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {preview.map((p, i) => <Table.Tr key={i}><Table.Td>{i + 1}</Table.Td><Table.Td>{p.name}</Table.Td><Table.Td>{p.gender ?? '-'}</Table.Td></Table.Tr>)}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Modal>
  )
}
