import { Button, Container, Group, NumberInput, Paper, Switch, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'
import { StateSkeleton } from '../components/StateComponents'
import { parsePatientId } from '../lib/path'

interface R {
  metric: string
  min?: number
  max?: number
  enabled: boolean
  label?: string
  unit?: string
}

export function PatientAlertRules() {
  const pid = parsePatientId()
  const {
    data: rules,
    isLoading,
    refetch,
  } = useGet<R[]>(`/alert-rules/patients/${pid}/alert-rules`)
  const [localRules, setLocalRules] = useState<R[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (rules) setLocalRules(rules)
  }, [rules])

  if (isLoading || !rules) return <StateSkeleton lines={4} />

  if (rules.length === 0) {
    return (
      <Container py="md">
        <Text c="dimmed" ta="center" mt="xl">
          暂无告警规则
        </Text>
      </Container>
    )
  }

  const toggle = (i: number) => {
    const n = [...localRules]
    n[i] = { ...n[i], enabled: !n[i].enabled }
    setLocalRules(n)
  }

  const updateMin = (i: number, v: string | number) => {
    const n = [...localRules]
    n[i] = { ...n[i], min: v === '' ? undefined : Number(v) }
    setLocalRules(n)
  }

  const updateMax = (i: number, v: string | number) => {
    const n = [...localRules]
    n[i] = { ...n[i], max: v === '' ? undefined : Number(v) }
    setLocalRules(n)
  }

  const save = async () => {
    setSaving(true)
    try {
      await http.put(`/alert-rules/patients/${pid}/alert-rules`, { rules: localRules } as any)
      notifications.show({ title: '已保存', color: 'green', message: '告警规则已更新' })
      refetch()
    } catch {
      notifications.show({ title: '保存失败', color: 'red', message: '请重试' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container py="md">
      <Group justify="flex-end" mb="md">
        <Button loading={saving} onClick={save}>
          保存
        </Button>
      </Group>
      {localRules.map((r, i) => (
        <Paper key={r.metric} p="sm" mb="xs" withBorder>
          <Group gap="xs" mb="xs">
            <Switch checked={r.enabled} onChange={() => toggle(i)} />
            <span>{r.label || r.metric}</span>
            {r.unit && <span>({r.unit})</span>}
          </Group>
          {r.enabled && (
            <Group>
              <NumberInput
                size="xs"
                label="最小值"
                w={120}
                value={r.min ?? ''}
                onChange={(v) => updateMin(i, v)}
              />
              <NumberInput
                size="xs"
                label="最大值"
                w={120}
                value={r.max ?? ''}
                onChange={(v) => updateMax(i, v)}
              />
            </Group>
          )}
        </Paper>
      ))}
    </Container>
  )
}
