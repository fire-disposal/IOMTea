import { Button, Container, Group, NumberInput, Paper, Skeleton, Switch } from '@mantine/core'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

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
  const [rules, setRules] = useState<R[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    http.get('/alert-rules/patients/' + pid + '/alert-rules').then((r) => {
      setRules(r.data as R[])
      setLoading(false)
    })
  }, [pid])

  const toggle = (i: number) => {
    const n = [...rules]
    n[i].enabled = !n[i].enabled
    setRules(n)
  }
  const upd = (i: number, f: string, v: string | number) => {
    const n = [...rules]
    ;(n[i] as any)[f] = v
    setRules(n)
  }
  const save = () => {
    setSaving(true)
    http
      .put('/alert-rules/patients/' + pid + '/alert-rules', { rules } as any)
      .finally(() => setSaving(false))
  }

  if (loading)
    return (
      <Container py="md">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={24} mb="sm" />
        ))}
      </Container>
    )

  return (
    <div>
      <Group justify="flex-end" mb="md">
        <Button loading={saving} onClick={save}>
          保存阈值
        </Button>
      </Group>
      {rules.map((r, i) => (
        <Paper key={r.metric} p="sm" mb="xs" withBorder>
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <Switch checked={r.enabled} onChange={() => toggle(i)} />
              <span style={{ fontWeight: 500 }}>
                {r.label || r.metric}{' '}
                {r.unit && <small style={{ color: '#868e96' }}>({r.unit})</small>}
              </span>
            </Group>
          </Group>
          {r.enabled && (
            <Group>
              <NumberInput
                size="xs"
                label="最小值"
                w={100}
                value={r.min ?? ''}
                onChange={(v) => upd(i, 'min', Number(v))}
              />
              <NumberInput
                size="xs"
                label="最大值"
                w={100}
                value={r.max ?? ''}
                onChange={(v) => upd(i, 'max', Number(v))}
              />
            </Group>
          )}
        </Paper>
      ))}
    </div>
  )
}
