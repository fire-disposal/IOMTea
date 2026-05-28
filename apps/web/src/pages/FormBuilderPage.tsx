import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconEdit, IconEye, IconFileCode, IconPlus, IconSend, IconTrash } from '@tabler/icons-react'
import yaml from 'js-yaml'
import { useCallback, useMemo, useState } from 'react'
import { http } from '../api/client'
import { useDelete, useGet, usePost } from '../api/hooks'
import { CronInput } from '../components/CronInput'
import { StateEmpty, StateSkeleton } from '../components/StateComponents'

interface FormDef {
  id: string
  code: string
  title: string
  description?: string
  cron?: string
  fields: FormField[]
  yamlFields?: string
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

const FIELD_TYPES = [
  { value: 'choice', label: '单选题' },
  { value: 'multi', label: '多选题' },
  { value: 'likert', label: '李克特量表' },
  { value: 'vas', label: '视觉模拟(VAS)' },
  { value: 'number', label: '数值输入' },
  { value: 'text', label: '文本输入' },
]

const FIELD_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  FIELD_TYPES.map((t) => [t.value, t.label]),
)

function fieldsToYaml(fields: FormField[]): string {
  try {
    const clean = fields.map((f) => {
      const o: Record<string, unknown> = { id: f.id, type: f.type, label: f.label }
      if (!f.required) o.required = false
      if (f.options) o.options = Object.fromEntries(f.options.map((x) => [x.value, x.label]))
      if (f.labels) o.labels = f.labels
      if (f.min_label) o.min_label = f.min_label
      if (f.max_label) o.max_label = f.max_label
      if (f.min !== undefined) o.min = f.min
      if (f.max !== undefined) o.max = f.max
      if (f.unit) o.unit = f.unit
      if (f.placeholder) o.placeholder = f.placeholder
      if (f.rows !== undefined && f.rows !== 3) o.rows = f.rows
      return o
    })
    return yaml.dump(clean, { indent: 2, lineWidth: 120, noRefs: true })
  } catch {
    return ''
  }
}

function yamlToFields(text: string): { fields: FormField[]; error?: string } {
  try {
    const data = yaml.load(text)
    if (!Array.isArray(data)) return { fields: [], error: 'YAML 格式错误：需要数组' }
    const fields: FormField[] = data.map((item: Record<string, unknown>, i: number) => {
      const base: FormField = {
        id: String(item.id ?? `f_${i}`),
        type: String(item.type ?? 'text'),
        label: String(item.label ?? ''),
        required: item.required !== false,
      }
      if (item.options && typeof item.options === 'object') {
        base.options = Object.entries(item.options as Record<string, string>).map(([k, v]) => ({
          value: k,
          label: String(v),
        }))
      }
      if (Array.isArray(item.labels)) base.labels = item.labels.map(String)
      if (item.min_label) base.min_label = String(item.min_label)
      if (item.max_label) base.max_label = String(item.max_label)
      if (typeof item.min === 'number') base.min = item.min
      if (typeof item.max === 'number') base.max = item.max
      if (item.unit) base.unit = String(item.unit)
      if (item.placeholder) base.placeholder = String(item.placeholder)
      if (typeof item.rows === 'number') base.rows = item.rows
      return base
    })
    return { fields }
  } catch (e) {
    return { fields: [], error: `YAML 解析错误: ${(e as Error).message}` }
  }
}

function validate(fields: FormField[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const f of fields) {
    if (!f.id) errors.push('字段缺少 id')
    if (!f.label) errors.push(`字段 ${f.id || '(无ID)'} 缺少 label`)
    if (ids.has(f.id)) errors.push(`字段 ID "${f.id}" 重复`)
    ids.add(f.id)
    if ((f.type === 'choice' || f.type === 'multi') && (!f.options || f.options.length < 1))
      errors.push(`字段 "${f.id}" (${f.type}) 至少需要一个选项`)
    if (f.type === 'likert' && (!f.labels || f.labels.length < 2))
      errors.push(`字段 "${f.id}" (likert) 至少需要2个标签`)
    if (f.type === 'likert' && f.labels && f.labels.length > 9)
      errors.push(`字段 "${f.id}" (likert) 标签最多9个`)
  }
  return errors
}

function FormPreview({ fields }: { fields: FormField[] }) {
  return (
    <Stack gap="md">
      {fields.map((field) => (
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
          {field.type === 'choice' &&
            field.options?.map((opt) => (
              <Text key={opt.value} size="sm" c="dimmed">
                ○ {opt.label}
              </Text>
            ))}
          {field.type === 'multi' &&
            field.options?.map((opt) => (
              <Text key={opt.value} size="sm" c="dimmed">
                ☐ {opt.label}
              </Text>
            ))}
          {field.type === 'likert' && field.labels && (
            <Group gap="xs">
              {field.labels.map((l) => (
                <Badge key={l} variant="light" size="sm">
                  {l}
                </Badge>
              ))}
            </Group>
          )}
          {field.type === 'vas' && (
            <Box>
              <div
                style={{
                  height: 4,
                  background: 'var(--mantine-color-gray-3)',
                  borderRadius: 2,
                }}
              />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {field.min_label || '0'}
                </Text>
                <Text size="xs" c="dimmed">
                  {field.max_label || '100'}
                </Text>
              </Group>
            </Box>
          )}
          {field.type === 'number' && (
            <NumberInput
              disabled
              size="xs"
              style={{ maxWidth: 160 }}
              min={field.min}
              max={field.max}
            />
          )}
          {field.type === 'text' && (
            <Textarea
              disabled
              size="xs"
              placeholder={field.placeholder || ''}
              rows={field.rows || 3}
            />
          )}
        </Paper>
      ))}
    </Stack>
  )
}

interface _FormResponse {
  id: string
  responses: Record<string, unknown>
  submittedAt: string
}

function FormResponsesView({ formCode }: { formCode: string }) {
  const { data: responses, isLoading } = useGet<_FormResponse[]>(
    `/forms/${formCode}/responses`,
  )
  const { data: forms } = useGet<FormDef[]>('/forms')
  const form = (forms ?? []).find((f) => f.code === formCode)
  if (isLoading) return <StateSkeleton lines={5} />
  if (!form || !responses || responses.length === 0) return <StateEmpty message="暂无响应" />
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        共 {responses.length} 条响应
      </Text>
      {responses.map((r) => (
        <Paper key={r.id} p="sm" withBorder>
          <Text size="xs" c="dimmed">
            {new Date(r.submittedAt).toLocaleString('zh-CN')}
          </Text>
          {form.fields.map((f) => {
            const val = r.responses[f.id]
            let display = String(val ?? '-')
            if (f.type === 'choice' && f.options) {
              const opt = f.options.find((o) => o.value === val)
              if (opt) display = opt.label
            }
            if (f.type === 'multi' && f.options && Array.isArray(val)) {
              display = val.map((v) => f.options?.find((o) => o.value === v)?.label || v).join(', ')
            }
            if (f.type === 'number' && f.unit) display = `${val} ${f.unit}`
            return (
              <Text key={f.id} size="sm">
                <Text span fw={500}>
                  {f.label}:
                </Text>{' '}
                {display}
              </Text>
            )
          })}
        </Paper>
      ))}
    </Stack>
  )
}

function FieldOptionsEditor({
  value,
  onChange,
}: {
  value: { value: string; label: string }[]
  onChange: (opts: { value: string; label: string }[]) => void
}) {
  const add = () => onChange([...value, { value: `opt_${Date.now()}`, label: '' }])
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const set = (i: number, field: 'value' | 'label', v: string) =>
    onChange(value.map((o, idx) => (idx === i ? { ...o, [field]: v } : o)))
  return (
    <Stack gap="xs">
      <Text size="xs" fw={500}>
        选项
      </Text>
      {value.map((o, i) => (
        <Group key={`opt-${o.value}-${i}`} gap="xs">
          <TextInput
            size="xs"
            placeholder="值"
            value={o.value}
            onChange={(e) => set(i, 'value', e.currentTarget.value)}
            w={80}
          />
          <TextInput
            size="xs"
            placeholder="标签"
            value={o.label}
            onChange={(e) => set(i, 'label', e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <ActionIcon size="sm" variant="subtle" color="red" onClick={() => remove(i)}>
            <IconTrash size={12} />
          </ActionIcon>
        </Group>
      ))}
      <Button size="xs" variant="light" onClick={add}>
        + 添加选项
      </Button>
    </Stack>
  )
}

export function FormBuilderPage() {
  const { data: forms, isLoading, refetch } = useGet<FormDef[]>('/forms')
  const [search, setSearch] = useState('')
  const createForm = usePost('/forms', ['forms'])
  const deleteForm = useDelete('/forms/:id', ['forms'])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<FormDef>>({ code: '', title: '', fields: [] })
  const [editorMode, setEditorMode] = useState<'visual' | 'yaml'>('visual')
  const [yamlText, setYamlText] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [fieldModal, setFieldModal] = useState(false)
  const [editingFieldIdx, setEditingFieldIdx] = useState<number | null>(null)
  const [responseViewCode, setResponseViewCode] = useState<string | null>(null)
  const [currentField, setCurrentField] = useState<Partial<FormField>>({
    type: 'text',
    label: '',
    required: true,
  })

  const openEditor = (f?: FormDef) => {
    setEditorOpen(true)
    if (f) {
      setEditingCode(f.code)
      setFormData({
        code: f.code,
        title: f.title,
        description: f.description,
        cron: f.cron,
        fields: f.fields,
      })
      setYamlText(f.yamlFields || fieldsToYaml(f.fields))
    } else {
      setEditingCode(null)
      setFormData({ code: '', title: '', description: '', cron: '', fields: [] })
      setYamlText('')
    }
    setValidationErrors([])
    setEditorMode('visual')
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditingCode(null)
    setFormData({ code: '', title: '', fields: [] })
    setYamlText('')
    setValidationErrors([])
  }

  const syncYamlToFields = useCallback((yaml: string) => {
    const { fields, error } = yamlToFields(yaml)
    if (!error) setFormData((prev) => ({ ...prev, fields }))
    return error
  }, [])

  const syncFieldsToYaml = useCallback((fields: FormField[]) => {
    setYamlText(fieldsToYaml(fields))
  }, [])

  const handleSave = async () => {
    if (!formData.code || !formData.title) {
      notifications.show({ color: 'red', title: '请填写代码和标题', message: '' })
      return
    }
    const errs = validate(formData.fields || [])
    if (errs.length > 0) {
      setValidationErrors(errs)
      notifications.show({ color: 'red', title: `格式错误 (${errs.length}项)`, message: '' })
      return
    }
    setSaving(true)
    try {
      const body = {
        ...formData,
        yamlFields: yamlText || fieldsToYaml(formData.fields || []),
      }
      if (editingCode) {
        await http.patch(`/forms/${editingCode}`, body)
      } else {
        await http.post('/forms', body)
      }
      notifications.show({ color: 'green', title: '已保存', message: '' })
      closeEditor()
      refetch()
    } catch {
      notifications.show({ color: 'red', title: '保存失败', message: '' })
    } finally {
      setSaving(false)
    }
  }

  const openFieldEditor = (f?: FormField, idx?: number) => {
    if (f) {
      setCurrentField({ ...f })
      setEditingFieldIdx(idx ?? null)
    } else {
      setCurrentField({ type: 'text', label: '', required: true, id: `f_${Date.now()}` })
      setEditingFieldIdx(null)
    }
    setFieldModal(true)
  }

  const saveField = () => {
    if (!currentField.id || !currentField.label) return
    const next = [...(formData.fields || [])]
    if (editingFieldIdx !== null) {
      next[editingFieldIdx] = currentField as FormField
    } else {
      next.push(currentField as FormField)
    }
    setFormData({ ...formData, fields: next })
    if (editorMode === 'visual') syncFieldsToYaml(next)
    setFieldModal(false)
    setCurrentField({ type: 'text', label: '', required: true })
    setEditingFieldIdx(null)
  }

  const handlePublish = async (code: string) => {
    try {
      await http.post(`/forms/${code}/publish`)
      notifications.show({ color: 'green', title: '已发布', message: '' })
      refetch()
    } catch {
      notifications.show({ color: 'red', title: '发布失败', message: '' })
    }
  }

  const handleUnpublish = async (code: string) => {
    try {
      await http.post(`/forms/${code}/unpublish`)
      notifications.show({ color: 'green', title: '已取消发布', message: '' })
      refetch()
    } catch {
      notifications.show({ color: 'red', title: '操作失败', message: '' })
    }
  }

  const filtered = useMemo(
    () =>
      (forms ?? []).filter(
        (f) =>
          !search ||
          f.title.toLowerCase().includes(search.toLowerCase()) ||
          f.code.toLowerCase().includes(search.toLowerCase()),
      ),
    [forms, search],
  )

  if (isLoading) return <StateSkeleton lines={8} />

  if (editorOpen) {
    const fields = formData.fields || []
    return (
      <Container py="md" fluid>
        <Group mb="md" justify="space-between">
          <Title order={3}>
            {editingCode ? `编辑: ${formData.title || editingCode}` : '新建量表'}
          </Title>
          <Group gap="xs">
            <Button
              variant="light"
              onClick={() => {
                const errs = validate(fields)
                setValidationErrors(errs)
                if (errs.length === 0)
                  notifications.show({ color: 'green', title: '格式验证通过', message: '' })
              }}
            >
              格式验证
            </Button>
            <Button loading={saving} onClick={handleSave}>
              保存
            </Button>
            <Button variant="subtle" onClick={closeEditor}>
              取消
            </Button>
          </Group>
        </Group>
        {validationErrors.length > 0 && (
          <Paper p="sm" withBorder mb="md" bg="red.0">
            <Text size="sm" c="red" fw={500}>
              验证错误:
            </Text>
            {validationErrors.map((e) => (
              <Text key={e} size="xs" c="red">
                - {e}
              </Text>
            ))}
          </Paper>
        )}
        <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
          <Paper withBorder style={{ flex: 1, overflow: 'auto' }} p="sm">
            <Stack gap="sm">
              <TextInput
                label="代码"
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.currentTarget.value })}
                disabled={!!editingCode}
                size="xs"
              />
              <TextInput
                label="标题"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.currentTarget.value })}
                size="xs"
              />
              <Textarea
                label="描述"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
                size="xs"
                rows={2}
              />
              <CronInput
                value={formData.cron || ''}
                onChange={(v) => setFormData({ ...formData, cron: v })}
              />
              <Tabs
                value={editorMode}
                onChange={(v) => setEditorMode((v as 'visual' | 'yaml') || 'visual')}
              >
                <Tabs.List>
                  <Tabs.Tab value="visual" leftSection={<IconEye size={14} />}>
                    可视化
                  </Tabs.Tab>
                  <Tabs.Tab value="yaml" leftSection={<IconFileCode size={14} />}>
                    YAML
                  </Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="visual" pt="sm">
                  <Stack gap="xs">
                    {(fields || []).map((f, i) => (
                      <Paper
                        key={f.id}
                        p="xs"
                        withBorder
                        style={{ cursor: 'pointer' }}
                        onClick={() => openFieldEditor(f, i)}
                      >
                        <Group justify="space-between">
                          <Box>
                            <Text size="sm">
                              {f.label || '(未命名)'}{' '}
                              <Badge size="xs" variant="outline">
                                {FIELD_TYPE_LABEL[f.type] || f.type}
                              </Badge>
                            </Text>
                            <Text size="xs" c="dimmed">
                              {f.id}
                              {f.required ? ' *必填' : ''}
                            </Text>
                          </Box>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation()
                              const next = fields.filter((_, idx) => idx !== i)
                              setFormData({ ...formData, fields: next })
                              if (editorMode === 'visual') syncFieldsToYaml(next)
                            }}
                          >
                            <IconTrash size={12} />
                          </ActionIcon>
                        </Group>
                      </Paper>
                    ))}
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconPlus size={12} />}
                      onClick={() => openFieldEditor()}
                    >
                      添加字段
                    </Button>
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel value="yaml" pt="sm">
                  <Textarea
                    value={yamlText}
                    onChange={(e) => {
                      setYamlText(e.currentTarget.value)
                      syncYamlToFields(e.currentTarget.value)
                    }}
                    minRows={10}
                    maxRows={30}
                    styles={{ input: { fontFamily: 'monospace', fontSize: 13 } }}
                    placeholder="# 在此编写 YAML 格式的字段定义"
                  />
                </Tabs.Panel>
              </Tabs>
            </Stack>
          </Paper>
          <Paper withBorder style={{ width: 400, overflow: 'auto' }} p="sm">
            <Text fw={600} mb="sm" size="sm">
              预览 ({fields.length} 字段)
            </Text>
            <FormPreview fields={fields} />
          </Paper>
        </div>

        <Modal opened={fieldModal} onClose={() => setFieldModal(false)} title="字段设置" size="sm">
          <Stack>
            <TextInput
              label="字段 ID"
              value={currentField.id || ''}
              onChange={(e) => setCurrentField({ ...currentField, id: e.currentTarget.value })}
              size="xs"
            />
            <TextInput
              label="标签"
              value={currentField.label || ''}
              onChange={(e) => setCurrentField({ ...currentField, label: e.currentTarget.value })}
              size="xs"
            />
            <Select
              label="类型"
              data={FIELD_TYPES}
              value={currentField.type}
              onChange={(v) => v && setCurrentField({ ...currentField, type: v })}
              size="xs"
            />
            <Switch
              label="必填"
              checked={currentField.required !== false}
              onChange={(e) =>
                setCurrentField({ ...currentField, required: e.currentTarget.checked })
              }
              size="xs"
            />
            {currentField.type === 'choice' && (
              <FieldOptionsEditor
                value={currentField.options || []}
                onChange={(opts) => setCurrentField({ ...currentField, options: opts })}
              />
            )}
            {currentField.type === 'multi' && (
              <FieldOptionsEditor
                value={currentField.options || []}
                onChange={(opts) => setCurrentField({ ...currentField, options: opts })}
              />
            )}
            {currentField.type === 'likert' && (
              <Textarea
                label="标签（逗号分隔）"
                value={(currentField.labels || []).join(', ')}
                onChange={(e) =>
                  setCurrentField({
                    ...currentField,
                    labels: e.currentTarget.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                size="xs"
                rows={2}
              />
            )}
            {currentField.type === 'vas' && (
              <Group>
                <TextInput
                  label="最小值标签"
                  value={currentField.min_label || ''}
                  onChange={(e) =>
                    setCurrentField({ ...currentField, min_label: e.currentTarget.value })
                  }
                  size="xs"
                />
                <TextInput
                  label="最大值标签"
                  value={currentField.max_label || ''}
                  onChange={(e) =>
                    setCurrentField({ ...currentField, max_label: e.currentTarget.value })
                  }
                  size="xs"
                />
              </Group>
            )}
            {currentField.type === 'number' && (
              <Group>
                <NumberInput
                  label="最小值"
                  value={currentField.min ?? ''}
                  onChange={(v) =>
                    setCurrentField({ ...currentField, min: Number(v) || undefined })
                  }
                  size="xs"
                  w={100}
                />
                <NumberInput
                  label="最大值"
                  value={currentField.max ?? ''}
                  onChange={(v) =>
                    setCurrentField({ ...currentField, max: Number(v) || undefined })
                  }
                  size="xs"
                  w={100}
                />
                <TextInput
                  label="单位"
                  value={currentField.unit || ''}
                  onChange={(e) =>
                    setCurrentField({ ...currentField, unit: e.currentTarget.value })
                  }
                  size="xs"
                  w={80}
                />
              </Group>
            )}
            {currentField.type === 'text' && (
              <>
                <TextInput
                  label="占位符"
                  value={currentField.placeholder || ''}
                  onChange={(e) =>
                    setCurrentField({ ...currentField, placeholder: e.currentTarget.value })
                  }
                  size="xs"
                />
                <NumberInput
                  label="行数"
                  value={currentField.rows || 3}
                  onChange={(v) => setCurrentField({ ...currentField, rows: Number(v) || 3 })}
                  size="xs"
                  min={1}
                  max={20}
                />
              </>
            )}
            <Button onClick={saveField} disabled={!currentField.id || !currentField.label}>
              {editingFieldIdx !== null ? '更新字段' : '添加字段'}
            </Button>
          </Stack>
        </Modal>
      </Container>
    )
  }

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>量表管理</Title>
        <Group>
          <TextInput
            size="xs"
            placeholder="搜索量表..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={200}
          />
          <Button leftSection={<IconPlus size={14} />} onClick={() => openEditor()}>
            新建量表
          </Button>
        </Group>
      </Group>
      {filtered.length === 0 ? (
        <StateEmpty message={search ? '未找到匹配的量表' : '暂无量表'} />
      ) : (
        <Table striped stickyHeader highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>代码</Table.Th>
              <Table.Th>标题</Table.Th>
              <Table.Th>字段数</Table.Th>
              <Table.Th>状态</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map((f) => (
              <Table.Tr key={f.id}>
                <Table.Td>
                  <Badge variant="light">{f.code}</Badge>
                </Table.Td>
                <Table.Td>{f.title}</Table.Td>
                <Table.Td>{f.fields?.length ?? 0}</Table.Td>
                <Table.Td>
                  <Badge color={f.status === 'published' ? 'green' : 'gray'}>
                    {f.status === 'published' ? '已发布' : '草稿'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label="编辑" withArrow>
                      <ActionIcon variant="light" onClick={() => openEditor(f)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                    </Tooltip>
                    {f.status === 'published' ? (
                      <Tooltip label="取消发布" withArrow>
                        <ActionIcon
                          variant="light"
                          color="yellow"
                          onClick={() => handleUnpublish(f.code)}
                        >
                          <IconSend size={14} style={{ transform: 'rotate(180deg)' }} />
                        </ActionIcon>
                      </Tooltip>
                    ) : (
                      <Tooltip label="发布" withArrow>
                        <ActionIcon
                          variant="light"
                          color="green"
                          onClick={() => handlePublish(f.code)}
                        >
                          <IconSend size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    <Tooltip label="查看响应" withArrow>
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => setResponseViewCode(f.code)}
                      >
                        <IconEye size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="删除" withArrow>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => deleteForm.mutate(f.code)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={!!responseViewCode}
        onClose={() => setResponseViewCode(null)}
        title="表单响应"
        size="lg"
      >
        {responseViewCode && <FormResponsesView formCode={responseViewCode} />}
      </Modal>
    </Container>
  )
}
