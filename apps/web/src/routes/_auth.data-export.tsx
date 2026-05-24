import { createFileRoute } from '@tanstack/react-router'
import { Container, Title, Paper, Group, Select, Text, Table, Checkbox, Button, SegmentedControl } from '@mantine/core'
import { useState } from 'react'

const fieldOptions: Record<string, string[]> = {
  patients: ['id', 'name', 'gender', 'birth_date', 'phone', 'height_cm', 'weight_kg', 'blood_type', 'address', 'status', 'created_at'],
  events: ['id', 'patient_id', 'kind', 'metric', 'value', 'unit', 'source', 'severity', 'status', 'recorded_at', 'created_at'],
  medications: ['id', 'patient_id', 'drug_name', 'dosage', 'dosage_unit', 'frequency', 'route', 'start_date', 'end_date', 'status', 'created_at'],
  devices: ['id', 'serial_number', 'device_type', 'model', 'manufacturer', 'status', 'room_id', 'last_seen', 'created_at'],
}

function DataExportPage() {
  const [entity, setEntity] = useState<string>('patients')
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv')

  return (
    <Container size="lg" py="md">
      <Title order={2} mb="md">数据导出</Title>
      <Paper p="md" withBorder mb="md">
        <Group>
          <Select label="导出实体" data={[
            { value: 'patients', label: '患者' },
            { value: 'events', label: '事件' },
            { value: 'medications', label: '用药' },
            { value: 'devices', label: '设备' },
          ]} value={entity} onChange={(v) => { setEntity(v!); setSelectedFields([]) }} />
          <SegmentedControl data={[
            { value: 'csv', label: 'CSV' },
            { value: 'xlsx', label: 'Excel' },
          ]} value={format} onChange={(v) => setFormat(v as any)} />
        </Group>
        <Checkbox.Group label="选择字段" value={selectedFields} onChange={setSelectedFields} mt="md">
          <Group>
            {fieldOptions[entity]?.map((f: string) => (
              <Checkbox key={f} value={f} label={f} />
            ))}
          </Group>
        </Checkbox.Group>
        <Button mt="md" disabled={selectedFields.length === 0}>导出 {format.toUpperCase()}</Button>
      </Paper>
    </Container>
  )
}

export const Route = createFileRoute('/_auth/data-export')({
  component: DataExportPage,
})
