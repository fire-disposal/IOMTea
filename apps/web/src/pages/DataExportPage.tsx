import { Container, Title, Group, Select, Button, Table, Text, Paper } from '@mantine/core'
import { useState } from 'react'
import { http } from '../api/client'
import { notifications } from '@mantine/notifications'

export function DataExportPage() {
  const [format, setFormat] = useState<'csv' | 'long' | 'wide'>('csv')
  const [preview, setPreview] = useState<{ columns: string[]; rows: Record<string, unknown>[]; total: number } | null>(null)
  const [exporting, setExporting] = useState(false)

  const loadPreview = async () => {
    const res = await http.get('/export/preview', { params: { limit: 20 } })
    setPreview(res.data as any)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await http.post('/export/download', { format } as any)
      const { data: base64, filename, mime } = res.data as any
      const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const blob = new Blob([binary], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      notifications.show({ title: '导出成功', message: filename, color: 'green' })
    } finally { setExporting(false) }
  }

  return (
    <Container py="md">
      <Title order={2} mb="md">数据导出</Title>
      <Paper p="md" withBorder mb="md">
        <Group mb="md">
          <Select
            label="导出格式"
            data={[
              { value: 'csv', label: 'CSV (扁平表)' },
              { value: 'long', label: 'Long (Tidy Data)' },
              { value: 'wide', label: 'Wide (SPSS 重复测量)' },
            ]}
            value={format}
            onChange={(v) => setFormat(v as any)}
          />
        </Group>
        <Group>
          <Button variant="light" onClick={loadPreview}>预览</Button>
          <Button loading={exporting} onClick={handleExport}>导出 {format.toUpperCase()}</Button>
        </Group>
      </Paper>

      {preview && (
        <Paper p="md" withBorder>
          <Text size="sm" mb="sm">预览 ({preview.total} 条记录)</Text>
          <Table striped stickyHeader>
            <Table.Thead>
              <Table.Tr>{preview.columns.map((c) => <Table.Th key={c}>{c}</Table.Th>)}</Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {preview.rows.map((row, i) => (
                <Table.Tr key={i}>
                  {preview.columns.map((c) => <Table.Td key={c}>{String(row[c] ?? '-')}</Table.Td>)}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Container>
  )
}
