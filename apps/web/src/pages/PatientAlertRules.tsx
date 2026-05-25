import { Container, Title, Paper, Text, Switch, TextInput, NumberInput, Button, Group } from '@mantine/core'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

interface Rule { metric: string; min?: number; max?: number; enabled: boolean; label?: string; unit?: string }

export function PatientAlertRules({ patientId }: { patientId: string }) {
  const [rules, setRules] = useState<Rule[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    http.get('/alert-rules/patients/' + patientId + '/alert-rules').then((r) => setRules(r.data as Rule[]))
  }, [patientId])

  const toggle = (i: number) => { const next = [...rules]; next[i].enabled = !next[i].enabled; setRules(next) }
  const update = (i: number, field: string, value: string | number) => { const next = [...rules]; (next[i] as any)[field] = value; setRules(next) }

  const save = async () => {
    setSaving(true)
    await http.put('/alert-rules/patients/' + patientId + '/alert-rules', { rules } as any)
    setSaving(false)
  }

  return (
    <Container py="md">
      <Group justify="space-between" mb="md"><Title order={3}>告警阈值</Title><Button loading={saving} onClick={save}>保存</Button></Group>
      {rules.map((r, i) => (
        <Paper key={r.metric} p="sm" mb="xs" withBorder>
          <Group justify="space-between" mb="xs">
            <Group gap="xs"><Switch checked={r.enabled} onChange={() => toggle(i)} /><Text fw={500}>{r.label || r.metric}</Text>{r.unit && <Text size="xs" c="dimmed">({r.unit})</Text>}</Group>
          </Group>
          {r.enabled && (
            <Group>
              <NumberInput size="xs" label="最小值" w={100} value={r.min ?? ''} onChange={(v) => update(i, 'min', Number(v))} />
              <NumberInput size="xs" label="最大值" w={100} value={r.max ?? ''} onChange={(v) => update(i, 'max', Number(v))} />
            </Group>
          )}
        </Paper>
      ))}
    </Container>
  )
}
