import { useState, useCallback } from 'react'
import { Button, Modal, Table, Text, Group, Paper, PasswordInput, MultiSelect, Stepper, FileInput } from '@mantine/core'
import { IconUpload } from '@tabler/icons-react'
import { trpc } from '../trpc'

interface CsvRow {
  name: string; phone?: string; gender?: string; birth_date?: string
  height_cm?: string; weight_kg?: string; blood_type?: string
  address?: string; emergency_contact?: string; emergency_phone?: string
  _errors: string[]
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((_line, idx) => {
    const values = _line.split(',').map((v) => v.trim())
    const row: any = { _errors: [] }
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    if (!row.name) row._errors.push('姓名必填')
    if (row.gender && !['male', 'female', 'other'].includes(row.gender)) row._errors.push('性别无效')
    if (row.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.birth_date)) row._errors.push('日期格式错误')
    return row
  })
}

interface PatientImportProps {
  opened: boolean
  onClose: () => void
  onImported: () => void
}

export function PatientImport({ opened, onClose, onImported }: PatientImportProps) {
  const [rows, setRows] = useState<CsvRow[]>([])
  const [defaultPassword, setDefaultPassword] = useState('123456')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<{ created: number; errors: any[] } | null>(null)

  const { data: tags } = trpc.tag.list.useQuery()

  const bulkCreate = trpc.patient.bulkCreate.useMutation({
    onSuccess: (res) => { setResult(res); setStep(2); onImported() },
  })

  const handleFile = useCallback((file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setRows(parseCsv(e.target?.result as string))
      setStep(1)
    }
    reader.readAsText(file)
  }, [])

  const validRows = rows.filter((r) => r._errors.length === 0)
  const invalidRows = rows.filter((r) => r._errors.length > 0)

  const handleImport = () => {
    if (!defaultPassword || validRows.length === 0) return
    bulkCreate.mutate({
      defaultPassword,
      tagIds: selectedTags,
      patients: validRows.map((r) => ({
        name: r.name,
        phone: r.phone || undefined,
        gender: r.gender as any,
        birthDate: r.birth_date || undefined,
        heightCm: r.height_cm ? Number(r.height_cm) : undefined,
        weightKg: r.weight_kg ? Number(r.weight_kg) : undefined,
        bloodType: r.blood_type as any,
        address: r.address || undefined,
        emergencyContact: r.emergency_contact || undefined,
        emergencyPhone: r.emergency_phone || undefined,
      })),
    })
  }

  const handleClose = () => { setRows([]); setStep(0); setResult(null); onClose() }

  return (
    <Modal opened={opened} onClose={handleClose} title="批量导入患者" size="xl">
      <Stepper active={step} onStepClick={setStep}>
        <Stepper.Step label="上传文件" description="CSV 格式">
          <Text size="xs" c="dimmed" mb="sm">
            CSV 表头格式: <Text span ff="monospace">name,phone,gender,birth_date,height_cm,weight_kg,blood_type,address,emergency_contact,emergency_phone</Text>
            <br />必填: <Text span fw={500}>name</Text>。性别取值: male/female/other。日期格式: YYYY-MM-DD。
            <br />示例行: <Text span ff="monospace">张三,13800138000,male,1980-05-15,170,65,A,北京市东城区,张四,13900139000</Text>
          </Text>
          <FileInput
            label="选择 CSV 文件"
            placeholder="点击选择 .csv 文件"
            accept="text/csv"
            leftSection={<IconUpload size={18} />}
            onChange={handleFile}
            clearable
          />
        </Stepper.Step>

        <Stepper.Step label="预览校验" description={`${validRows.length} 有效 / ${invalidRows.length} 无效`}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>姓名</Table.Th>
                <Table.Th>手机</Table.Th>
                <Table.Th>性别</Table.Th>
                <Table.Th>错误</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, i) => (
                <Table.Tr key={i} bg={row._errors.length > 0 ? 'red.0' : undefined}>
                  <Table.Td>{i + 1}</Table.Td>
                  <Table.Td>{row.name}</Table.Td>
                  <Table.Td>{row.phone}</Table.Td>
                  <Table.Td>{row.gender}</Table.Td>
                  <Table.Td c="red">{row._errors.join(', ')}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group mt="md">
            <PasswordInput label="默认密码" value={defaultPassword} onChange={(e) => setDefaultPassword(e.currentTarget.value)} required />
            <MultiSelect label="附加标签" data={tags?.map((t) => ({ value: t.id, label: t.name })) ?? []} value={selectedTags} onChange={setSelectedTags} />
          </Group>
          <Button mt="md" onClick={handleImport} loading={bulkCreate.isPending} disabled={!defaultPassword || validRows.length === 0}>
            导入 {validRows.length} 条
          </Button>
        </Stepper.Step>

        <Stepper.Step label="结果" description={result ? `成功 ${result.created}` : ''}>
          {result && (
            <>
              <Text c="green" fw={600}>成功: {result.created} 条</Text>
              {result.errors?.length > 0 && <Text c="red">失败: {result.errors.length} 条</Text>}
              <Button mt="md" onClick={handleClose}>完成</Button>
            </>
          )}
        </Stepper.Step>
      </Stepper>
    </Modal>
  )
}
