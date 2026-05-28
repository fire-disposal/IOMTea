import {
  Badge,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useMemo, useState } from 'react'

interface CronInputProps {
  value: string
  onChange: (value: string) => void
}

const PRESETS = [
  { label: '每小时', cron: '0 * * * *', desc: '每小时的整点' },
  { label: '每天 9:00', cron: '0 9 * * *', desc: '每天 09:00' },
  { label: '每天 21:00', cron: '0 21 * * *', desc: '每天 21:00' },
  { label: '每周一 9:00', cron: '0 9 * * 1', desc: '每周一 09:00' },
  { label: '工作日 8:00', cron: '0 8 * * 1-5', desc: '工作日 08:00' },
  { label: '每月1号', cron: '0 0 1 * *', desc: '每月1日 00:00' },
]

const MINUTES = ['*', ...Array.from({ length: 60 }, (_, i) => String(i))]
const HOURS = ['*', ...Array.from({ length: 24 }, (_, i) => String(i))]
const DAYS = ['*', ...Array.from({ length: 31 }, (_, i) => String(i + 1))]
const MONTHS = [
  { value: '*', label: '每月' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` })),
]
const WEEKDAYS = [
  { value: '*', label: '每天' },
  { value: '0', label: '周日' },
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
  { value: '1-5', label: '工作日' },
  { value: '0,6', label: '周末' },
]

function parseCron(cron: string): {
  minute: string
  hour: string
  day: string
  month: string
  weekday: string
} {
  const parts = cron.trim().split(/\s+/)
  return {
    minute: parts[0] || '*',
    hour: parts[1] || '*',
    day: parts[2] || '*',
    month: parts[3] || '*',
    weekday: parts[4] || '*',
  }
}

export function describeCron(cron: string): string {
  try {
    const p = parseCron(cron)
    const parts: string[] = []
    const isEveryMinute = p.minute === '*'
    const isEveryHour = p.hour === '*'

    if (isEveryMinute && isEveryHour) {
      parts.push('每分钟')
    } else if (isEveryHour) {
      parts.push(`每小时的第 ${p.minute} 分`)
    } else if (isEveryMinute) {
      parts.push(`每天的 ${p.hour} 点`)
    } else {
      parts.push(`${p.hour.padStart(2, '0')}:${p.minute.padStart(2, '0')}`)
    }

    if (p.weekday !== '*') {
      const wd = WEEKDAYS.find((w) => w.value === p.weekday)
      if (wd) parts.push(`每${wd.label}`)
    } else if (p.day !== '*') {
      parts.push(`每月 ${p.day} 日`)
    } else {
      parts.push('每天')
    }

    if (p.month !== '*') {
      const m = MONTHS.find((m) => m.value === p.month)
      if (m) parts.push(m.label)
    }

    return parts.join(' ') || '无效表达式'
  } catch {
    return '无效表达式'
  }
}

export function CronInput({ value, onChange }: CronInputProps) {
  const [mode, setMode] = useState<'preset' | 'builder' | 'text'>('preset')
  const parsed = useMemo(() => parseCron(value), [value])
  const description = useMemo(() => describeCron(value), [value])
  const isValid = useMemo(() => {
    if (!value.trim()) return true
    const parts = value.trim().split(/\s+/)
    return parts.length === 5
  }, [value])

  const setPart = (part: 'minute' | 'hour' | 'day' | 'month' | 'weekday', val: string) => {
    const p = parseCron(value)
    p[part] = val
    onChange(`${p.minute} ${p.hour} ${p.day} ${p.month} ${p.weekday}`)
  }

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Badge
          size="lg"
          variant="dot"
          color={isValid ? 'teal' : 'red'}
          styles={{ label: { fontFamily: 'monospace', fontSize: 13 } }}
        >
          {value || '未设置'}
        </Badge>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      </Group>

      <SegmentedControl
        size="xs"
        value={mode}
        onChange={(v) => setMode(v as 'preset' | 'builder' | 'text')}
        data={[
          { value: 'preset', label: '快速选择' },
          { value: 'builder', label: '可视构建' },
          { value: 'text', label: '直接输入' },
        ]}
        fullWidth
      />

      {mode === 'preset' && (
        <Paper p="xs" withBorder>
          <Group gap="xs">
            {PRESETS.map((p) => (
              <Tooltip key={p.cron} label={`${p.cron} — ${p.desc}`} withArrow>
                <Badge
                  size="sm"
                  variant={value === p.cron ? 'filled' : 'outline'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onChange(p.cron)}
                >
                  {p.label}
                </Badge>
              </Tooltip>
            ))}
          </Group>
        </Paper>
      )}

      {mode === 'builder' && (
        <Paper p="xs" withBorder>
          <Group gap="xs" wrap="nowrap" align="end">
            <Select
              size="xs"
              label="分钟"
              data={MINUTES}
              value={parsed.minute}
              onChange={(v) => setPart('minute', v || '*')}
              w={80}
            />
            <Select
              size="xs"
              label="小时"
              data={HOURS}
              value={parsed.hour}
              onChange={(v) => setPart('hour', v || '*')}
              w={80}
            />
            <Select
              size="xs"
              label="日"
              data={DAYS}
              value={parsed.day}
              onChange={(v) => setPart('day', v || '*')}
              w={80}
            />
            <Select
              size="xs"
              label="月"
              data={MONTHS}
              value={parsed.month}
              onChange={(v) => setPart('month', v || '*')}
              w={90}
            />
            <Select
              size="xs"
              label="周"
              data={WEEKDAYS}
              value={parsed.weekday}
              onChange={(v) => setPart('weekday', v || '*')}
              w={90}
            />
          </Group>
        </Paper>
      )}

      {mode === 'text' && (
        <TextInput
          size="xs"
          placeholder="例: 0 9 * * *  (分 时 日 月 周)"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          error={
            !isValid && value.trim().length > 0 ? '格式错误：需5个字段 (分 时 日 月 周)' : undefined
          }
          styles={{ input: { fontFamily: 'monospace' } }}
        />
      )}
    </Stack>
  )
}
