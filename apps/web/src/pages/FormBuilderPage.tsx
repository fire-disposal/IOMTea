import {
  ActionIcon,
  Badge,
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
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconEdit, IconEye, IconPlus, IconSend, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { http } from '../api/client'
import { useDelete, useGet, usePost } from '../api/hooks'
import { StateEmpty } from '../components/StateComponents'

interface FormDef {
  id: string
  code: string
  title: string
  description?: string
  cron?: string
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

const FIELD_TYPES = [
  { value: 'choice', label: '单选题' },
  { value: 'multi', label: '多选题' },
  { value: 'likert', label: '李克特量表' },
  { value: 'vas', label: '视觉模拟(VAS)' },
  { value: 'number', label: '数值输入' },
  { value: 'text', label: '文本输入' },
]

export function FormBuilderPage() {
  const { data: forms, isLoading, refetch } = useGet<FormDef[]>('/forms')
  const [search, setSearch] = useState('')
  const createForm = usePost('/forms', ['forms'])
  const deleteForm = useDelete('/forms/:id', ['forms'])
  const [modalOpen, { open, close }] = useDisclosure(false)
  const [formData, setFormData] = useState<Partial<FormDef>>({ code: '', title: '', fields: [] })
  const [editing, setEditing] = useState<string | null>(null)
  const [fieldModal, setFieldModal] = useState(false)
  const [currentField, setCurrentField] = useState<Partial<FormField>>({
    type: 'text',
    label: '',
    required: true,
  })
  const [editingFieldIdx, setEditingFieldIdx] = useState<number | null>(null)
  const [previewCode, setPreviewCode] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setFormData({ code: '', title: '', description: '', cron: '', fields: [] })
    open()
  }

  const openEdit = (f: FormDef) => {
    setEditing(f.code)
    setFormData({
      code: f.code,
      title: f.title,
      description: f.description,
      cron: f.cron,
      fields: f.fields,
    })
    open()
  }

  const addField = () => {
    if (!currentField.id || !currentField.label) return
    const fields = [...(formData.fields || [])]
    if (editingFieldIdx !== null) {
      fields[editingFieldIdx] = currentField as FormField
    } else {
      fields.push(currentField as FormField)
    }
    setFormData({ ...formData, fields })
    setFieldModal(false)
    setCurrentField({ type: 'text', label: '', required: true })
    setEditingFieldIdx(null)
  }

  const removeField = (idx: number) => {
    const fields = (formData.fields || []).filter((_, i) => i !== idx)
    setFormData({ ...formData, fields })
  }

  const save = async () => {
    try {
      if (editing) {
        await http.patch(`/forms/${editing}`, formData)
      } else {
        await http.post('/forms', formData)
      }
      notifications.show({ title: '已保存', color: 'green', message: '' })
      close()
      refetch()
    } catch {
      notifications.show({ title: '保存失败', color: 'red', message: '' })
    }
  }

  const publish = async (code: string) => {
    try {
      await http.post(`/forms/${code}/publish`)
      notifications.show({ title: '已发布', color: 'green', message: '' })
      refetch()
    } catch {
      notifications.show({ title: '发布失败', color: 'red', message: '' })
    }
  }

  const unpublish = async (code: string) => {
    try {
      await http.post(`/forms/${code}/unpublish`)
      notifications.show({ title: '已取消发布', color: 'green', message: '' })
      refetch()
    } catch {
      notifications.show({ title: '操作失败', color: 'red', message: '' })
    }
  }

  const previewForm = forms?.find((f) => f.code === previewCode)

  const filtered = (forms ?? []).filter(
    (f) =>
      !search ||
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase()),
  )

  if (isLoading)
    return (
      <Container py="md">
        <Title order={2}>量表管理</Title>
      </Container>
    )

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
          {previewCode && (
            <Button variant="subtle" onClick={() => setPreviewCode(null)}>
              退出预览
            </Button>
          )}
          <Button leftSection={<IconPlus size={14} />} onClick={openCreate}>
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
                      <ActionIcon variant="light" onClick={() => openEdit(f)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="预览" withArrow>
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => setPreviewCode(f.code)}
                      >
                        <IconEye size={14} />
                      </ActionIcon>
                    </Tooltip>
                    {f.status === 'published' ? (
                      <Tooltip label="取消发布" withArrow>
                        <ActionIcon
                          variant="light"
                          color="yellow"
                          onClick={() => unpublish(f.code)}
                        >
                          <IconSend size={14} style={{ transform: 'rotate(180deg)' }} />
                        </ActionIcon>
                      </Tooltip>
                    ) : (
                      <Tooltip label="发布" withArrow>
                        <ActionIcon variant="light" color="green" onClick={() => publish(f.code)}>
                          <IconSend size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
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

      {previewForm && (
        <Paper p="lg" withBorder mt="md">
          <Title order={3} mb="md">
            {previewForm.title}
          </Title>
          {previewForm.description && (
            <Text c="dimmed" mb="md">
              {previewForm.description}
            </Text>
          )}
          <Stack gap="md">
            {previewForm.fields.map((field) => (
              <Paper key={field.id} p="sm" withBorder>
                <Text fw={500} mb="xs">
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
                    {field.labels.map((l, i) => (
                      <Badge key={i} variant="light" size="sm">
                        {l}
                      </Badge>
                    ))}
                  </Group>
                )}
                {field.type === 'vas' && (
                  <Group>
                    <Text size="xs" c="dimmed">
                      {field.min_label || 'Min'}
                    </Text>
                    <div
                      style={{
                        flex: 1,
                        height: 4,
                        background: 'var(--mantine-color-gray-3)',
                        borderRadius: 2,
                      }}
                    />
                    <Text size="xs" c="dimmed">
                      {field.max_label || 'Max'}
                    </Text>
                  </Group>
                )}
                {field.type === 'number' && (
                  <Group gap="xs">
                    <NumberInput
                      disabled
                      style={{ width: 120 }}
                      min={field.min}
                      max={field.max}
                      rightSection={field.unit ? <Text size="xs">{field.unit}</Text> : undefined}
                    />
                  </Group>
                )}
                {field.type === 'text' && (
                  <Textarea disabled placeholder={field.placeholder || ''} rows={field.rows || 3} />
                )}
              </Paper>
            ))}
          </Stack>
          <Group justify="flex-end" mt="md">
            <Button>提交</Button>
          </Group>
        </Paper>
      )}

      <Modal opened={modalOpen} onClose={close} title={editing ? '编辑量表' : '新建量表'} size="lg">
        <Stack>
          <TextInput
            label="代码"
            value={formData.code || ''}
            onChange={(e) => setFormData({ ...formData, code: e.currentTarget.value })}
            disabled={!!editing}
          />
          <TextInput
            label="标题"
            value={formData.title || ''}
            onChange={(e) => setFormData({ ...formData, title: e.currentTarget.value })}
          />
          <Textarea
            label="描述"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
          />
          <TextInput
            label="Cron 表达式 (可选)"
            value={formData.cron || ''}
            onChange={(e) => setFormData({ ...formData, cron: e.currentTarget.value })}
          />

          <Group justify="space-between">
            <Text fw={500}>字段 ({(formData.fields || []).length})</Text>
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                setCurrentField({ type: 'text', label: '', required: true, id: `f_${Date.now()}` })
                setEditingFieldIdx(null)
                setFieldModal(true)
              }}
            >
              + 添加字段
            </Button>
          </Group>

          {(formData.fields || []).map((f, i) => (
            <Paper key={f.id} p="xs" withBorder>
              <Group justify="space-between">
                <Text size="sm">
                  {f.label}{' '}
                  <Badge size="xs" variant="outline">
                    {f.type}
                  </Badge>
                </Text>
                <Group gap="xs">
                  <Tooltip label="编辑字段" withArrow>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => {
                        setCurrentField(f)
                        setEditingFieldIdx(i)
                        setFieldModal(true)
                      }}
                    >
                      <IconEdit size={12} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="删除字段" withArrow>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => removeField(i)}
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Paper>
          ))}

          <Group justify="flex-end">
            <Button variant="subtle" onClick={close}>
              取消
            </Button>
            <Button onClick={save} disabled={!formData.code || !formData.title}>
              保存
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={fieldModal} onClose={() => setFieldModal(false)} title="字段设置" size="sm">
        <Stack>
          <TextInput
            label="字段 ID"
            value={currentField.id || ''}
            onChange={(e) => setCurrentField({ ...currentField, id: e.currentTarget.value })}
          />
          <TextInput
            label="标签"
            value={currentField.label || ''}
            onChange={(e) => setCurrentField({ ...currentField, label: e.currentTarget.value })}
          />
          <Select
            label="类型"
            data={FIELD_TYPES}
            value={currentField.type}
            onChange={(v) => v && (setCurrentField({ ...currentField, type: v }) as any)}
          />
          {currentField.type === 'number' && (
            <Group>
              <NumberInput
                label="最小值"
                value={currentField.min ?? ''}
                onChange={(v) => setCurrentField({ ...currentField, min: Number(v) || undefined })}
                w={100}
              />
              <NumberInput
                label="最大值"
                value={currentField.max ?? ''}
                onChange={(v) => setCurrentField({ ...currentField, max: Number(v) || undefined })}
                w={100}
              />
              <TextInput
                label="单位"
                value={currentField.unit || ''}
                onChange={(e) => setCurrentField({ ...currentField, unit: e.currentTarget.value })}
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
              />
              <NumberInput
                label="行数"
                value={currentField.rows || 3}
                onChange={(v) => setCurrentField({ ...currentField, rows: Number(v) || 3 })}
                min={1}
                max={20}
              />
            </>
          )}
          <Button onClick={addField} disabled={!currentField.id || !currentField.label}>
            {editingFieldIdx !== null ? '更新字段' : '添加字段'}
          </Button>
        </Stack>
      </Modal>
    </Container>
  )
}
