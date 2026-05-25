import {
  Button,
  Container,
  Group,
  Paper,
  Select,
  Skeleton,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useGet, usePost } from '../api/hooks'

export function DataExportPage() {
  const [format, setFormat] = useState('csv')
  const { data: preview, isLoading } = useGet<{
    columns: string[]
    rows: Record<string, unknown>[]
    total: number
  }>('/export/preview', { limit: 20 })
  const doExport = usePost('/export/download')

  const handleExport = () => {
    doExport.mutate({ format } as any, {
      onSuccess: (data: any) => {
        const binary = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0))
        const blob = new Blob([binary], { type: data.mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.filename
        a.click()
        URL.revokeObjectURL(url)
      },
    })
  }

  return (
    <Container py="md">
      <Title order={2} mb="md">
        数据导出
      </Title>
      <Paper p="md" withBorder mb="md">
        <Group mb="md">
          <Select
            label="格式"
            data={[
              { value: 'csv', label: 'CSV' },
              { value: 'long', label: 'Long' },
              { value: 'wide', label: 'Wide' },
            ]}
            value={format}
            onChange={(v) => setFormat(v ?? 'csv')}
          />
        </Group>
        <Button loading={doExport.isPending} onClick={handleExport}>
          导出 {format.toUpperCase()}
        </Button>
      </Paper>
      {isLoading ? (
        <Skeleton height={100} />
      ) : (
        preview && (
          <Paper p="md" withBorder>
            <Text size="sm" mb="sm">
              预览 ({preview.total} 条)
            </Text>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  {preview.columns.map((c) => (
                    <Table.Th key={c}>{c}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {preview.rows.map((r, i) => (
                  <Table.Tr key={i}>
                    {preview.columns.map((c) => (
                      <Table.Td key={c}>{String(r[c] ?? '-')}</Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )
      )}
    </Container>
  )
}
