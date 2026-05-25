import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Slider,
  Stack,
  Text,
  TextInput,
  Title,
  CopyButton,
  SegmentedControl,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { toPng } from 'html-to-image'
import { IconArrowBackUp, IconArrowForwardUp } from '@tabler/icons-react'
import {
  AVATAR_EDITOR_FIELDS,
  AvatarSpecSchema,
  DEFAULT_AVATAR_SPEC,
  migrateMiiParamsToAvatarSpec,
  parseAvatarSpec,
  type AvatarSpec,
  type MiiParams,
} from '@iomtea/shared-types'
import { randomAvatarSpec, renderAvatarSvg } from '@iomtea/avatar-core'

export interface MiiEditorProps {
  initialSpec?: AvatarSpec | MiiParams
  size?: number
  onChange?: (spec: AvatarSpec) => void
}

const PRESETS: Array<{ label: string; value: string; spec: AvatarSpec }> = [
  { label: '默认', value: 'default', spec: DEFAULT_AVATAR_SPEC },
  {
    label: '学院风',
    value: 'school',
    spec: {
      ...DEFAULT_AVATAR_SPEC,
      face: { ...DEFAULT_AVATAR_SPEC.face, shape: 'round', skinTone: 1 },
      hair: { style: 'short', color: 2 },
      accessory: { glasses: 'round', hat: 'none' },
      palette: { background: 2, clothing: 6 },
      theme: 'soft',
    },
  },
  {
    label: '活力风',
    value: 'active',
    spec: {
      ...DEFAULT_AVATAR_SPEC,
      face: { ...DEFAULT_AVATAR_SPEC.face, shape: 'oval', skinTone: 3 },
      eyes: { ...DEFAULT_AVATAR_SPEC.eyes, style: 'smile', size: 1.1 },
      mouth: { ...DEFAULT_AVATAR_SPEC.mouth, style: 'laugh', openness: 0.7 },
      hair: { style: 'curly', color: 5 },
      palette: { background: 4, clothing: 1 },
    },
  },
]

const getValue = (input: AvatarSpec, path: string): unknown => {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, input)
}

const setValue = (input: AvatarSpec, path: string, value: unknown): AvatarSpec => {
  const keys = path.split('.')
  const output: Record<string, unknown> = structuredClone(input) as Record<string, unknown>
  let cursor: Record<string, unknown> = output

  for (let i = 0; i < keys.length - 1; i += 1) {
    const next = cursor[keys[i]]
    if (!next || typeof next !== 'object') {
      cursor[keys[i]] = {}
    }
    cursor = cursor[keys[i]] as Record<string, unknown>
  }

  cursor[keys[keys.length - 1]] = value
  return output as AvatarSpec
}

const normalizeFieldValue = (raw: string | null): string | number | boolean => {
  if (raw == null) return ''
  if (raw === '1') return true
  if (raw === '0') return false
  const asNumber = Number(raw)
  return Number.isNaN(asNumber) ? raw : asNumber
}

export function MiiEditor({ initialSpec, size = 280, onChange }: MiiEditorProps) {
  const initial = useMemo(() => {
    if (!initialSpec) return DEFAULT_AVATAR_SPEC
    return parseAvatarSpec(initialSpec)
  }, [initialSpec])

  const [spec, setSpec] = useState<AvatarSpec>(initial)
  const [history, setHistory] = useState<AvatarSpec[]>([])
  const [future, setFuture] = useState<AvatarSpec[]>([])
  const [seedInput, setSeedInput] = useState('')
  const [preset, setPreset] = useState('default')
  const previewRef = useRef<HTMLDivElement>(null)

  const validation = AvatarSpecSchema.safeParse(spec)

  const applySpec = useCallback(
    (next: AvatarSpec, trackHistory = true) => {
      setSpec((prev) => {
        if (trackHistory) {
          setHistory((h) => [...h.slice(-29), prev])
          setFuture([])
        }
        onChange?.(next)
        return next
      })
    },
    [onChange],
  )

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setFuture((f) => [spec, ...f.slice(0, 29)])
      setSpec(prev)
      onChange?.(prev)
      return h.slice(0, -1)
    })
  }, [onChange, spec])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[0]
      setHistory((h) => [...h.slice(-29), spec])
      setSpec(next)
      onChange?.(next)
      return f.slice(1)
    })
  }, [onChange, spec])

  const updateField = useCallback(
    (path: string, value: unknown) => {
      const next = setValue(spec, path, value)
      const parsed = AvatarSpecSchema.safeParse(next)
      if (!parsed.success) {
        notifications.show({
          title: '参数无效',
          message: parsed.error.issues[0]?.message ?? '未知错误',
          color: 'red',
        })
        return
      }
      applySpec(parsed.data)
    },
    [applySpec, spec],
  )

  const svg = useMemo(() => renderAvatarSvg(spec, { size }), [size, spec])
  const json = useMemo(() => JSON.stringify(spec, null, 2), [spec])

  const exportSvg = useCallback(() => {
    const blob = new Blob([renderAvatarSvg(spec, { includeXmlHeader: true })], {
      type: 'image/svg+xml',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `avatar-${Date.now()}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }, [spec])

  const exportPng = useCallback(async () => {
    if (!previewRef.current) return
    const dataUrl = await toPng(previewRef.current, { pixelRatio: 2 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `avatar-${Date.now()}.png`
    a.click()
  }, [])

  const applySeed = useCallback(() => {
    const next = randomAvatarSpec(seedInput.trim() || Date.now())
    applySpec(next)
  }, [applySpec, seedInput])

  const applyPreset = useCallback(
    (value: string) => {
      setPreset(value)
      const found = PRESETS.find((item) => item.value === value)
      if (found) applySpec(found.spec)
    },
    [applySpec],
  )

  const resetFromV1 = useCallback(() => {
    applySpec(migrateMiiParamsToAvatarSpec())
  }, [applySpec])

  const sections = useMemo(() => {
    const map = new Map<string, typeof AVATAR_EDITOR_FIELDS>()
    for (const field of AVATAR_EDITOR_FIELDS) {
      const group = map.get(field.section) ?? []
      group.push(field)
      map.set(field.section, group)
    }
    return Array.from(map.entries())
  }, [])

  return (
    <Paper p="xl" radius="md" withBorder>
      <Title order={3}>Avatar Spec v2 编辑器</Title>
      <Text size="sm" c="dimmed" mb="md">
        SVG-based 前脸渲染 + schema-driven 控件
      </Text>

      <Group align="flex-start" wrap="wrap" gap="lg">
        <Stack gap="sm" style={{ minWidth: 300, flex: '0 0 320px' }}>
          <Paper
            withBorder
            p="xs"
            radius="md"
            ref={previewRef}
            style={{ width: size, height: size }}
          >
            <Box dangerouslySetInnerHTML={{ __html: svg }} />
          </Paper>

          <Group gap={6}>
            <Button size="xs" variant="light" onClick={() => applySpec(randomAvatarSpec())}>
              随机
            </Button>
            <Button size="xs" variant="light" onClick={applySeed}>
              按种子
            </Button>
            <Button size="xs" variant="light" onClick={exportSvg}>
              导出 SVG
            </Button>
            <Button size="xs" variant="light" onClick={() => void exportPng()}>
              导出 PNG
            </Button>
          </Group>

          <Group gap={6}>
            <ActionIcon
              onClick={undo}
              disabled={history.length === 0}
              variant="light"
              aria-label="undo"
            >
              <IconArrowBackUp size={16} />
            </ActionIcon>
            <ActionIcon
              onClick={redo}
              disabled={future.length === 0}
              variant="light"
              aria-label="redo"
            >
              <IconArrowForwardUp size={16} />
            </ActionIcon>
            <Button size="xs" variant="subtle" onClick={resetFromV1}>
              迁移 v1 默认值
            </Button>
          </Group>

          <TextInput
            size="xs"
            value={seedInput}
            onChange={(event) => setSeedInput(event.currentTarget.value)}
            placeholder="输入 seed 后点击“按种子”"
          />

          <SegmentedControl
            fullWidth
            size="xs"
            value={preset}
            onChange={applyPreset}
            data={PRESETS.map((item) => ({ label: item.label, value: item.value }))}
          />

          <CopyButton value={json}>
            {({ copied, copy }) => (
              <Button size="xs" variant="light" color={copied ? 'teal' : 'gray'} onClick={copy}>
                {copied ? 'JSON 已复制' : '复制 JSON'}
              </Button>
            )}
          </CopyButton>

          <Paper
            withBorder
            p="xs"
            style={{ maxHeight: 230, overflow: 'auto', background: '#f8f9fa' }}
          >
            <Text component="pre" size="xs" style={{ margin: 0 }}>
              {json}
            </Text>
          </Paper>
        </Stack>

        <Stack style={{ minWidth: 340, flex: 1 }} gap="md">
          <Group justify="space-between">
            <Badge color={validation.success ? 'green' : 'red'} variant="light">
              {validation.success ? '参数合法' : '参数校验失败'}
            </Badge>
            {!validation.success && (
              <Text c="red" size="xs">
                {validation.error.issues[0]?.message}
              </Text>
            )}
          </Group>

          {sections.map(([name, fields]) => (
            <Paper key={name} withBorder p="sm" radius="md">
              <Text fw={600} mb={8}>
                {name}
              </Text>
              <Stack gap="xs">
                {fields.map((field) => {
                  const raw = getValue(spec, field.key)

                  if (field.control === 'slider') {
                    return (
                      <Box key={field.key}>
                        <Group justify="space-between" mb={4}>
                          <Text size="xs" c="dimmed">
                            {field.label}
                          </Text>
                          <NumberInput
                            size="xs"
                            hideControls
                            value={typeof raw === 'number' ? Number(raw.toFixed(2)) : 0}
                            onChange={(value) =>
                              updateField(field.key, typeof value === 'number' ? value : 0)
                            }
                            w={72}
                          />
                        </Group>
                        <Slider
                          size="sm"
                          value={typeof raw === 'number' ? raw : 0}
                          onChange={(value) => updateField(field.key, value)}
                          min={field.min ?? 0}
                          max={field.max ?? 1}
                          step={field.step ?? 0.01}
                        />
                      </Box>
                    )
                  }

                  const data = (field.options ?? []).map((option) => ({
                    value: String(option.value),
                    label: option.label,
                  }))

                  return (
                    <Select
                      key={field.key}
                      size="xs"
                      label={field.label}
                      value={String(raw)}
                      data={data}
                      onChange={(value) => updateField(field.key, normalizeFieldValue(value))}
                    />
                  )
                })}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Group>
    </Paper>
  )
}
