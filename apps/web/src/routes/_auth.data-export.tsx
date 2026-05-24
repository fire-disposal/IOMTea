import { createFileRoute } from '@tanstack/react-router'
import { Container, Title, Paper, Group, Select, Text, Table, Checkbox, Button, SegmentedControl, Badge, Box } from '@mantine/core'
import { useState } from 'react'
import { trpc } from '../trpc'

const FIELD_OPTIONS: Record<string, string[]> = {
  patients: ['id', 'name', 'gender', 'birth_date', 'phone', 'height_cm', 'weight_kg', 'blood_type', 'address', 'status', 'created_at'],
  events: ['id', 'patient_id', 'kind', 'metric', 'value', 'unit', 'source', 'severity', 'status', 'pin_code', 'recorded_at', 'created_at'],
  medications: ['id', 'patient_id', 'drug_name', 'dosage', 'dosage_unit', 'frequency', 'route', 'start_date', 'end_date', 'status', 'created_at'],
}

const ENTITY_LABELS: Record<string, string> = {
  patients: '患者', events: '事件', medications: '用药',
}

function DataExportPage() {
  const [entity, setEntity] = useState<string>('patients')
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv')

  const { data: preview, isLoading } = trpc.export.preview.useQuery(
    { entity: entity as any, fields: selectedFields.length > 0 ? selectedFields : ['id'] },
    { enabled: true },
  )

  const downloadMutation = trpc.export.download.useMutation({
    onSuccess: (result) => {
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
    },
  })

  const handleExport = () => {
    if (selectedFields.length === 0) return
    downloadMutation.mutate({ entity: entity as any, fields: selectedFields, format })
  }

  const selectAll = () => setSelectedFields([...FIELD_OPTIONS[entity]])
  const clearAll = () => setSelectedFields([])

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md">数据导出</Title>

      <Paper p="md" withBorder mb="md">
        <Group align="end">
          <Select
            label="导出实体"
            data={Object.entries(FIELD_OPTIONS).map(([k, v]) => ({ value: k, label: `${ENTITY_LABELS[k]} (${v.length}字段)` }))}
            value={entity}
            onChange={(v) => { setEntity(v!); setSelectedFields([]) }}
          />
          <SegmentedControl
            data={[
              { value: 'csv', label: 'CSV' },
              { value: 'xlsx', label: 'Excel' },
            ]}
            value={format}
            onChange={(v) => setFormat(v as any)}
          />
        </Group>

        <Group mt="md" justify="space-between">
          <Text size="sm" fw={500}>选择导出字段</Text>
          <Group gap="xs">
            <Button size="compact-xs" variant="subtle" onClick={selectAll}>全选</Button>
            <Button size="compact-xs" variant="subtle" color="gray" onClick={clearAll}>清空</Button>
          </Group>
        </Group>

        <Checkbox.Group value={selectedFields} onChange={setSelectedFields} mt="xs">
          <Group>
            {FIELD_OPTIONS[entity]?.map((f: string) => (
              <Checkbox key={f} value={f} label={f} size="sm" />
            ))}
          </Group>
        </Checkbox.Group>

        <Button mt="lg" onClick={handleExport} loading={downloadMutation.isPending} disabled={selectedFields.length === 0}>
          导出 {format.toUpperCase()} ({selectedFields.length} 字段)
        </Button>
      </Paper>

      <Paper p="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>在线预览</Text>
          {preview && <Badge variant="light">{preview.total} 条记录</Badge>}
        </Group>

        {isLoading && <Text c="dimmed" ta="center" py="xl">加载中...</Text>}

        {!isLoading && (!preview || preview.rows.length === 0) && (
          <Text c="dimmed" ta="center" py="xl">选择字段后预览数据</Text>
        )}

        {preview && preview.rows.length > 0 && (
          <Box style={{ overflowX: 'auto' }}>
            <Table striped stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  {preview.columns.map((c: string) => (
                    <Table.Th key={c} style={{ whiteSpace: 'nowrap' }}>{c}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {preview.rows.map((row: any, i: number) => (
                  <Table.Tr key={i}>
                    {preview.columns.map((c: string) => (
                      <Table.Td key={c} style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                        {row[c] === null || row[c] === undefined ? '-' : String(row[c]).slice(0, 60)}
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

export const Route = createFileRoute('/_auth/data-export')({
  component: DataExportPage,
})
