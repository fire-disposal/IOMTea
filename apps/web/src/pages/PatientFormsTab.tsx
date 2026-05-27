import {
  Badge,
  Button,
  Container,
  Group,
  NumberInput,
  Paper,
  Radio,
  Slider,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'
import { parsePatientId } from '../lib/path'

interface FormDef {
  id: string
  code: string
  title: string
  description?: string
  fields: FormField[]
  status: string
}
interface FormField {
  id: string
  type: string
  label: string
  required: boolean
  options?: { value: string; label: string }[]
  labels?: string[]
  min_label?: string
  max_label?: string
  min?: number
  max?: number
  unit?: string
  placeholder?: string
  rows?: number
}
interface FormResponse {
  id: string
  formCode: string
  responses: Record<string, unknown>
  submittedAt: string
}

export function PatientFormsTab() {
  const pid = parsePatientId()
  const { data: forms } = useGet<FormDef[]>('/forms')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)

  const published = (forms ?? []).filter((f) => f.status === 'published')
  const form = published.find((f) => f.code === selectedCode)

  const submit = async () => {
    if (!selectedCode) return
    setSubmitting(true)
    try {
      await http.post(`/forms/${selectedCode}/respond`, {
        patientId: pid,
        responses: answers,
      })
      notifications.show({ color: 'green', title: '提交成功', message: '' })
      setSelectedCode(null)
      setAnswers({})
    } catch {
      notifications.show({ color: 'red', title: '提交失败', message: '请重试' })
    } finally {
      setSubmitting(false)
    }
  }

  if (published.length === 0) {
    return (
      <Container py="md">
        <Text c="dimmed">暂无可用表单</Text>
      </Container>
    )
  }

  if (form) {
    return (
      <Container py="md">
        <Button variant="subtle" size="xs" mb="md" onClick={() => setSelectedCode(null)}>
          ← 返回列表
        </Button>
        <Title order={3} mb="xs">
          {form.title}
        </Title>
        {form.description && (
          <Text c="dimmed" mb="md" size="sm">
            {form.description}
          </Text>
        )}
        <Stack gap="md">
          {form.fields.map((field) => (
            <Paper key={field.id} p="sm" withBorder>
              <Text fw={500} mb="xs" size="sm">
                {field.label}
                {field.required && (
                  <Text span c="red">
                    {' '}
                    *
                  </Text>
                )}
              </Text>
              {field.type === 'choice' && field.options && (
                <Radio.Group
                  value={String(answers[field.id] ?? '')}
                  onChange={(v) => setAnswers({ ...answers, [field.id]: v })}
                >
                  <Stack gap="xs">
                    {field.options.map((opt) => (
                      <Radio key={opt.value} value={opt.value} label={opt.label} size="xs" />
                    ))}
                  </Stack>
                </Radio.Group>
              )}
              {field.type === 'multi' && field.options && (
                <Stack gap="xs">
                  {field.options.map((opt) => {
                    const selected = ((answers[field.id] as string[]) ?? []).includes(opt.value)
                    return (
                      <Text
                        key={opt.value}
                        size="sm"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          const current = (answers[field.id] as string[]) ?? []
                          const next = selected
                            ? current.filter((v) => v !== opt.value)
                            : [...current, opt.value]
                          setAnswers({ ...answers, [field.id]: next })
                        }}
                      >
                        {selected ? '☑' : '☐'} {opt.label}
                      </Text>
                    )
                  })}
                </Stack>
              )}
              {field.type === 'likert' && field.labels && (
                <Radio.Group
                  value={String(answers[field.id] ?? '')}
                  onChange={(v) => setAnswers({ ...answers, [field.id]: v })}
                >
                  <Group gap="xs" wrap="nowrap">
                    {field.labels.map((l) => (
                      <Radio key={l} value={l} label={l} size="xs" style={{ flexDirection: 'column', alignItems: 'center' }} />
                    ))}
                  </Group>
                </Radio.Group>
              )}
              {field.type === 'vas' && (
                <Stack gap="xs">
                  <Slider
                    value={Number(answers[field.id] ?? 50)}
                    onChange={(v) => setAnswers({ ...answers, [field.id]: v })}
                    min={0}
                    max={100}
                    label={null}
                  />
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      {field.min_label || '0'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {field.max_label || '100'}
                    </Text>
                  </Group>
                </Stack>
              )}
              {field.type === 'number' && (
                <NumberInput
                  size="xs"
                  value={Number(answers[field.id] ?? '')}
                  onChange={(v) => setAnswers({ ...answers, [field.id]: v })}
                  min={field.min}
                  max={field.max}
                  rightSection={field.unit ? <Text size="xs">{field.unit}</Text> : undefined}
                  style={{ maxWidth: 160 }}
                />
              )}
              {field.type === 'text' && (
                <Textarea
                  size="xs"
                  value={String(answers[field.id] ?? '')}
                  onChange={(e) => setAnswers({ ...answers, [field.id]: e.currentTarget.value })}
                  placeholder={field.placeholder || ''}
                  rows={field.rows || 3}
                />
              )}
            </Paper>
          ))}
        </Stack>
        <Group justify="flex-end" mt="md">
          <Button onClick={submit} loading={submitting}>
            提交
          </Button>
        </Group>
      </Container>
    )
  }

  return (
    <Container py="md">
      <Title order={4} mb="md">
        健康表单
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        请选择一份表单开始填写
      </Text>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>表单名称</Table.Th>
            <Table.Th>字段数</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {published.map((f) => (
            <Table.Tr key={f.id}>
              <Table.Td>
                <Text size="sm">{f.title}</Text>
                {f.description && (
                  <Text size="xs" c="dimmed">
                    {f.description}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{f.fields.length}</Table.Td>
              <Table.Td>
                <Button
                  size="compact-sm"
                  variant="light"
                  onClick={() => {
                    setSelectedCode(f.code)
                    setAnswers({})
                  }}
                >
                  填写
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  )
}
