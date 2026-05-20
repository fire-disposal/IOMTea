import { useState, useCallback, useRef } from 'react'
import {
  Box, Button, Chip, Group, Paper, Select, Stack, Text, TextInput,
  Title, Tooltip, ActionIcon, Divider, CopyButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import NiceAvatar, { genConfig } from 'react-nice-avatar'
import type { AvatarFullConfig } from 'react-nice-avatar'
import { toPng } from 'html-to-image'

const SEX_OPTIONS = [
  { value: 'man', label: '男' },
  { value: 'woman', label: '女' },
]
const HAIR_STYLES_MAN = [
  { value: 'normal', label: '短发' },
  { value: 'thick', label: '浓密' },
  { value: 'mohawk', label: '莫西干' },
]
const HAIR_STYLES_WOMAN = [
  { value: 'normal', label: '中长发' },
  { value: 'womanLong', label: '长发' },
  { value: 'womanShort', label: '短发' },
]
const HAIR_COLORS = [
  { value: '#000', label: '黑色' },
  { value: '#77311D', label: '棕色' },
  { value: '#FC909F', label: '粉色' },
  { value: '#D2EFF3', label: '浅蓝' },
  { value: '#506AF4', label: '蓝色' },
  { value: '#F48150', label: '橙色' },
  { value: '#fff', label: '白色' },
]
const EYE_STYLES = [
  { value: 'circle', label: '圆眼' },
  { value: 'oval', label: '椭圆' },
  { value: 'smile', label: '笑眼' },
]
const NOSE_STYLES = [
  { value: 'short', label: '短鼻' },
  { value: 'long', label: '长鼻' },
  { value: 'round', label: '圆鼻' },
]
const MOUTH_STYLES = [
  { value: 'laugh', label: '大笑' },
  { value: 'smile', label: '微笑' },
  { value: 'peace', label: '平和' },
]
const GLASSES_STYLES = [
  { value: 'none', label: '无' },
  { value: 'round', label: '圆框' },
  { value: 'square', label: '方框' },
]
const HAT_STYLES = [
  { value: 'none', label: '无' },
  { value: 'beanie', label: '毛线帽' },
  { value: 'turban', label: '头巾' },
]
const SHIRT_STYLES = [
  { value: 'hoody', label: '卫衣' },
  { value: 'short', label: '短袖' },
  { value: 'polo', label: 'POLO' },
]
const SHIRT_COLORS = [
  { value: '#9287FF', label: '紫色' },
  { value: '#6BD9E9', label: '青色' },
  { value: '#FC909F', label: '粉色' },
  { value: '#F4D150', label: '黄色' },
  { value: '#77311D', label: '棕色' },
]
const BG_COLORS = [
  { value: '#E0DDFF', label: '淡紫' },
  { value: '#D2EFF3', label: '淡蓝' },
  { value: '#FFEDEF', label: '淡粉' },
  { value: '#FFEBA4', label: '淡黄' },
  { value: '#9287FF', label: '紫色' },
  { value: '#6BD9E9', label: '青色' },
  { value: '#F48150', label: '橙色' },
  { value: '#74D153', label: '绿色' },
]
const EAR_SIZES = [
  { value: 'small', label: '小耳' },
  { value: 'big', label: '大耳' },
]
const FACE_COLORS = [
  { value: '#F9C9B6', label: '白皙' },
  { value: '#AC6651', label: '小麦' },
]

export function getHairOptions(sex: string) {
  return sex === 'man' ? HAIR_STYLES_MAN : HAIR_STYLES_WOMAN
}

export interface MiiEditorProps {
  initialConfig?: Partial<AvatarFullConfig>
  size?: number
  onChange?: (config: Required<AvatarFullConfig>) => void
}

export function MiiEditor({ initialConfig, size = 280, onChange }: MiiEditorProps) {
  const [config, setConfig] = useState<Required<AvatarFullConfig>>(
    () => genConfig(initialConfig ?? {}) as Required<AvatarFullConfig>,
  )
  const [seed, setSeed] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)

  const update = useCallback((patch: Partial<AvatarFullConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch }
      onChange?.(next)
      return next
    })
  }, [onChange])

  const handleRandomize = useCallback(() => {
    const newConfig = genConfig() as Required<AvatarFullConfig>
    setConfig(newConfig)
    onChange?.(newConfig)
    setSeed('')
  }, [onChange])

  const handleSeed = useCallback((s: string) => {
    setSeed(s)
    if (s.trim()) {
      const newConfig = genConfig(s.trim()) as Required<AvatarFullConfig>
      setConfig(newConfig)
      onChange?.(newConfig)
    }
  }, [onChange])

  const handleExportPng = useCallback(async () => {
    if (!previewRef.current) return
    try {
      const dataUrl = await toPng(previewRef.current, { pixelRatio: 2, quality: 0.95 })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `avatar-${Date.now()}.png`
      a.click()
      notifications.show({ title: '导出成功', message: 'PNG 已下载', color: 'green' })
    } catch {
      notifications.show({ title: '导出失败', message: '', color: 'red' })
    }
  }, [])

  const configJson = JSON.stringify(config, null, 2)

  const chipGroup = (
    label: string,
    options: { value: string; label: string }[],
    current: string,
    onSelect: (v: string) => void,
  ) => (
    <Box mb="xs">
      <Text size="xs" c="dimmed" mb={4}>{label}</Text>
      <Chip.Group value={current} onChange={(v) => v && onSelect(v as string)}>
        <Group gap={4}>
          {options.map(opt => (
            <Chip key={opt.value} value={opt.value} size="xs" variant="light">
              {opt.label}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
    </Box>
  )

  const colorGroup = (
    label: string,
    options: { value: string; label: string }[],
    current: string,
    onSelect: (v: string) => void,
  ) => (
    <Box mb="xs">
      <Text size="xs" c="dimmed" mb={4}>{label}</Text>
      <Group gap={4}>
        {options.map(opt => (
          <Tooltip key={opt.value} label={opt.label}>
            <Box
              onClick={() => onSelect(opt.value)}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: opt.value,
                border: current === opt.value ? '3px solid var(--mantine-color-blue-6)' : '2px solid var(--mantine-color-gray-4)',
                cursor: 'pointer', boxShadow: current === opt.value ? '0 0 6px rgba(0,0,0,0.2)' : 'none',
              }}
            />
          </Tooltip>
        ))}
      </Group>
    </Box>
  )

  return (
    <Paper p="xl" radius="md" withBorder>
      <Title order={3} mb="lg">捏脸编辑器</Title>

      <Group align="flex-start" gap="xl" wrap="wrap">
        {/* Preview */}
        <Stack align="center" gap="sm" style={{ minWidth: 280 }}>
          <Box
            ref={previewRef}
            style={{ width: size, height: size, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
          >
            <NiceAvatar style={{ width: size, height: size }} shape="circle" {...config} />
          </Box>

          <Group gap={4} mt="xs">
            <Button size="xs" variant="light" onClick={handleRandomize}>随机生成</Button>
            <Button size="xs" variant="light" onClick={handleExportPng}>导出 PNG</Button>
            <CopyButton value={configJson}>
              {({ copied, copy }) => (
                <Button size="xs" variant="light" color={copied ? 'teal' : 'gray'} onClick={copy}>
                  {copied ? '已复制' : '复制 JSON'}
                </Button>
              )}
            </CopyButton>
          </Group>

          <TextInput
            placeholder="输入种子字符串 (如用户邮箱)"
            value={seed}
            onChange={e => handleSeed(e.currentTarget.value)}
            size="xs"
            w="100%"
            styles={{ input: { textAlign: 'center' } }}
          />
        </Stack>

        <Divider orientation="vertical" visibleFrom="sm" />

        {/* Controls */}
        <Stack gap="md" style={{ flex: 1, minWidth: 280 }}>
          {/* Gender */}
          {chipGroup('性别', SEX_OPTIONS, config.sex, v => update({ sex: v as 'man' | 'woman' }))}

          {/* Face */}
          <Text size="sm" fw={600}>面部</Text>
          {chipGroup('脸型', EAR_SIZES, config.earSize ?? 'small', v => update({ earSize: v as 'small' | 'big' }))}
          {colorGroup('肤色', FACE_COLORS, config.faceColor ?? '#F9C9B6', v => update({ faceColor: v }))}
          {chipGroup('眼型', EYE_STYLES, config.eyeStyle ?? 'circle', v => update({ eyeStyle: v as 'circle' | 'oval' | 'smile' }))}
          {chipGroup('鼻型', NOSE_STYLES, config.noseStyle ?? 'short', v => update({ noseStyle: v as 'short' | 'long' | 'round' }))}
          {chipGroup('嘴型', MOUTH_STYLES, config.mouthStyle ?? 'smile', v => update({ mouthStyle: v as 'laugh' | 'smile' | 'peace' }))}

          {/* Hair */}
          <Text size="sm" fw={600}>发型</Text>
          {chipGroup('发型', getHairOptions(config.sex), config.hairStyle, v => update({ hairStyle: v as any }))}
          {colorGroup('发色', HAIR_COLORS, config.hairColor ?? '#000', v => update({ hairColor: v }))}

          {/* Accessories */}
          <Text size="sm" fw={600}>配饰</Text>
          {chipGroup('眼镜', GLASSES_STYLES, config.glassesStyle ?? 'none', v => update({ glassesStyle: v as 'round' | 'square' | 'none' }))}
          {chipGroup('帽子', HAT_STYLES, config.hatStyle ?? 'none', v => update({ hatStyle: v as 'beanie' | 'turban' | 'none' }))}

          {/* Clothing */}
          <Text size="sm" fw={600}>衣着</Text>
          {chipGroup('款式', SHIRT_STYLES, config.shirtStyle ?? 'short', v => update({ shirtStyle: v as 'hoody' | 'short' | 'polo' }))}
          {colorGroup('颜色', SHIRT_COLORS, config.shirtColor ?? '#9287FF', v => update({ shirtColor: v }))}

          {/* Background */}
          <Text size="sm" fw={600}>背景</Text>
          {colorGroup('背景色', BG_COLORS, config.bgColor ?? '#D2EFF3', v => update({ bgColor: v, isGradient: false }))}
        </Stack>
      </Group>

      {/* JSON Preview */}
      <Paper withBorder p="sm" mt="xl" style={{ background: '#f8f9fa', maxHeight: 200, overflow: 'auto' }}>
        <Text size="xs" c="dimmed" mb={4}>配置 JSON</Text>
        <Text component="pre" size="xs" style={{ margin: 0, fontFamily: 'monospace' }}>
          {configJson}
        </Text>
      </Paper>
    </Paper>
  )
}
