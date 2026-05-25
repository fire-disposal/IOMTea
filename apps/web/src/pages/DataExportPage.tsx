import {
  Container,
  Title,
  Paper,
  Group,
  Text,
  Table,
  Badge,
  Box,
  Button,
} from '@mantine/core'
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

export function DataExportPage() {
  const [preview, setPreview] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [format, setFormat] = useState<string>('csv')

  const fetchPreview = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<any>('/export/preview', { limit: 50 })
      setPreview(data)
    } catch {
      setPreview(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchPreview() }, [fetchPreview])

  const handleExport = async () => {
    setDownloadLoading(true)
    try {
      const result = await api.post<any>('/export/download', { format } as any)
      if (result.data) {
        const binary = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))
        const blob = new Blob([binary], { type: result.mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } finally {
      setDownloadLoading(false)
    }
  }

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md">
        数据导出
      </Title>

      <Paper p="md" withBorder mb="md">
        <Group align="end" mb="md">
          <Text size="sm" fw={500}>
            导出格式: {format.toUpperCase()}
          </Text>
        </Group>

        <Button
          mt="lg"
          onClick={handleExport}
          loading={downloadLoading}
        >
          导出数据
        </Button>
      </Paper>

      <Paper p="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>数据预览</Text>
          {preview && <Badge variant="light">{preview.total} 条记录</Badge>}
        </Group>

        {isLoading && (
          <Text c="dimmed" ta="center" py="xl">
            加载中...
          </Text>
        )}

        {!isLoading && (!preview || preview.rows.length === 0) && (
          <Text c="dimmed" ta="center" py="xl">
            暂无数据
          </Text>
        )}

        {preview && preview.rows.length > 0 && (
          <Box style={{ overflowX: 'auto' }}>
            <Table striped stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  {preview.columns.map((c: string) => (
                    <Table.Th key={c} style={{ whiteSpace: 'nowrap' }}>
                      {c}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {preview.rows.map((row: any, i: number) => (
                  <Table.Tr key={i}>
                    {preview.columns.map((c: string) => (
                      <Table.Td key={c} style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                        {row[c] === null || row[c] === undefined
                          ? '-'
                          : String(row[c]).slice(0, 60)}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        )}
      </Paper>
    </Container>
  )
}

