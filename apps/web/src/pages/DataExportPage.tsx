import {
  Container, Title, Paper, Group, MultiSelect, Button, Table, Text, Stack,
  SegmentedControl, TextInput, Checkbox, Skeleton,
} from '@mantine/core'
import { useState, useMemo } from 'react'
import { useGet } from '../api/hooks'
import { http } from '../api/client'
import { notifications } from '@mantine/notifications'

interface Patient { id: string; name: string }
interface Metric { metric: string; displayName: string; unit: string; category: string }
interface PreviewData { columns: string[]; rows: Record<string, unknown>[]; total: number }

const EXPORT_FIELDS = [
  'recorded_at', 'patient_id', 'metric', 'value', 'unit',
  'source', 'kind', 'severity', 'status', 'pin_code',
]

export function DataExportPage() {
  const { data: patients } = useGet<Patient[]>('/patients', { pageSize: 200 })
  const { data: metrics } = useGet<Metric[]>('/data/metrics')
  const [selectedPatients, setSelectedPatients] = useState<string[]>([])
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [format, setFormat] = useState<'csv' | 'long' | 'wide'>('long')
  const [selectedFields, setSelectedFields] = useState<string[]>(['recorded_at', 'patient_id', 'metric', 'value', 'unit'])
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadPreview = async () => {
    setPreviewLoading(true)
    try {
      const params: Record<string, unknown> = { limit: 50 }
      if (selectedPatients.length === 1) params.patientId = selectedPatients[0]
      if (dateFrom) params.from = dateFrom
      if (dateTo) params.to = dateTo
      const res = await http.get('/export/preview', { params })
      setPreview(res.data as PreviewData)
    } finally { setPreviewLoading(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await http.post('/export/download', {
        format,
        patientId: selectedPatients[0],
        metrics: selectedMetrics,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      } as any)
      const { data: base64, filename, mime } = res.data as { data: string; filename: string; mime: string }
      const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const blob = new Blob([binary], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      notifications.show({ title: '导出成功', message: filename, color: 'green' })
    } catch (e: any) {
      notifications.show({ title: '导出失败', message: e.message, color: 'red' })
    } finally { setExporting(false) }
  }

  const filteredColumns = useMemo(() => {
    if (!preview) return []
    return preview.columns.filter((c) => selectedFields.includes(c) || selectedFields.length === 0)
  }, [preview, selectedFields])

  return (
    <Container py="md">
      <Title order={2} mb="md">科研数据导出</Title>

      <Paper p="md" withBorder mb="md">
        <Stack gap="md">
          <Group grow>
            <MultiSelect
              size="sm"
              label="选择患者"
              placeholder="全部患者"
              data={(patients ?? []).map((p) => ({ value: p.id, label: p.name }))}
              value={selectedPatients}
              onChange={setSelectedPatients}
              searchable
              clearable
            />
            <MultiSelect
              size="sm"
              label="选择指标"
              placeholder="全部指标"
              data={(metrics ?? []).map((m) => ({ value: m.metric, label: `${m.displayName} (${m.unit})` }))}
              value={selectedMetrics}
              onChange={setSelectedMetrics}
              searchable
              clearable
            />
          </Group>

          <Group grow>
            <TextInput size="sm" type="date" label="起始日期" value={dateFrom} onChange={(e) => setDateFrom(e.currentTarget.value)} />
            <TextInput size="sm" type="date" label="截止日期" value={dateTo} onChange={(e) => setDateTo(e.currentTarget.value)} />
            <div>
              <Text size="sm" fw={500} mb={4}>导出格式</Text>
              <SegmentedControl
                size="sm"
                fullWidth
                data={[
                  { value: 'csv', label: 'CSV' },
                  { value: 'long', label: 'Long (Tidy)' },
                  { value: 'wide', label: 'Wide (SPSS)' },
                ]}
                value={format}
                onChange={(v) => setFormat(v as 'csv' | 'long' | 'wide')}
              />
            </div>
          </Group>

          <div>
            <Text size="sm" fw={500} mb={4}>选择导出字段</Text>
            <Group gap="xs">
              <Checkbox.Group value={selectedFields} onChange={setSelectedFields}>
                <Group gap="xs">
                  {EXPORT_FIELDS.map((f) => (
                    <Checkbox key={f} value={f} label={f} size="xs" />
                  ))}
                </Group>
              </Checkbox.Group>
            </Group>
          </div>

          <Group>
            <Button variant="light" onClick={loadPreview} loading={previewLoading}>预览</Button>
            <Button onClick={handleExport} loading={exporting}>
              导出 {format.toUpperCase()} ({selectedPatients.length || '全部'}患者 · {selectedMetrics.length || '全部'}指标)
            </Button>
          </Group>
        </Stack>
      </Paper>

      {previewLoading && <Skeleton height={200} />}

      {preview && !previewLoading && (
        <Paper p="md" withBorder>
          <Text size="sm" mb="sm">预览 ({preview.total} 条记录 · {filteredColumns.length} 列)</Text>
          <Table striped stickyHeader style={{ maxHeight: 400, overflow: 'auto' }}>
            <Table.Thead>
              <Table.Tr>{filteredColumns.map((c) => <Table.Th key={c} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{c}</Table.Th>)}</Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {preview.rows.slice(0, 30).map((row, i) => (
                <Table.Tr key={i}>
                  {filteredColumns.map((c) => (
                    <Table.Td key={c} style={{ fontSize: 12 }}>
                      {row[c] === null || row[c] === undefined ? '-' : String(row[c]).slice(0, 40)}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Container>
  )
}
