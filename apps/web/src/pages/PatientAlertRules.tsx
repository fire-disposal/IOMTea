import { Button, Container, Group, NumberInput, Paper, Skeleton, Switch } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'

interface R {
  metric: string
  min?: number
  max?: number
  enabled: boolean
  label?: string
  unit?: string
}
function parseId() {
  return window.location.pathname.split('/patients/')[1]?.split('/')[0] || ''
}

export function PatientAlertRules() {
  const pid = parseId()
  const {
    data: rules,
    isLoading,
    refetch,
  } = useGet<R[]>(`/alert-rules/patients/${pid}/alert-rules`)
  const [saving, setSaving] = useState(false)

  if (isLoading || !rules)
    return (
      <Container py="md">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={24} mb="sm" />
        ))}
      </Container>
    )

  const toggle = (i: number) => {
    const n = [...rules]
    n[i].enabled = !n[i].enabled
  }
  const save = async () => {
    setSaving(true)
    try {
      await http.put(`/alert-rules/patients/${pid}/alert-rules`, { rules } as any)
      notifications.show({ title: '已保存', color: 'green', message: '' as any })
      refetch()
    } catch {
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
      {rules.map((r, i) => (
        <Paper key={r.metric} p="sm" mb="xs" withBorder>
          <Group gap="xs" mb="xs">
            <Switch checked={r.enabled} onChange={() => toggle(i)} />
            <span>{r.label || r.metric}</span>
          </Group>
          {r.enabled && (
            <Group>
              <NumberInput
                size="xs"
                label="Min"
                w={100}
                value={r.min ?? ''}
                onChange={(v) => {
                  rules[i].min = Number(v)
                }}
              />
              <NumberInput
                size="xs"
                label="Max"
                w={100}
                value={r.max ?? ''}
                onChange={(v) => {
                  rules[i].max = Number(v)
                }}
              />
            </Group>
          )}
        </Paper>
      ))}
    </Container>
  )
}
