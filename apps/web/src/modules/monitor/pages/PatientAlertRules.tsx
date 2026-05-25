import { Button, Group, NumberInput, Paper, Switch, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState, useEffect, useCallback } from 'react'
import { useForm } from '@tanstack/react-form'
import { api } from '../../../api/client'
import { StateSkeleton, StateError } from '../../../components/shared/StateComponents'

interface RuleItem {
  metric: string
  label?: string
  min?: number
  max?: number
  unit?: string
  enabled: boolean
}

export function PatientAlertRules({ patientId }: { patientId: string }) {
  const [rules, setRules] = useState<any[]>([])
  const [rLoading, setRLoading] = useState(true)
  const [rError, setRError] = useState(false)
  const [upsertLoading, setUpsertLoading] = useState(false)

  const fetchRules = useCallback(async () => {
    if (!patientId) return
    setRLoading(true)
    try {
      const data = await api.get<any[]>(`/alert-rules/patients/${patientId}/alert-rules`)
      setRules(data)
      setRError(false)
    } catch {
      setRError(true)
    } finally {
      setRLoading(false)
    }
  }, [patientId])

  useEffect(() => { fetchRules() }, [fetchRules])

  const upsert = async (updatedRules: any[]) => {
    setUpsertLoading(true)
    try {
      await api.put(`/alert-rules/patients/${patientId}/alert-rules`, { rules: updatedRules })
      notifications.show({ title: '已保存', message: '告警规则已更新', color: 'green' })
      fetchRules()
    } catch (err: any) {
      notifications.show({ title: '保存失败', message: err.message, color: 'red' })
    } finally {
      setUpsertLoading(false)
    }
  }

  const form = useForm({
    defaultValues: {} as Record<string, { min?: number; max?: number; enabled: boolean }>,
    onSubmit: ({ value }) => {
      const updatedRules = (rules ?? []).map((r: any) => ({
        metric: r.metric,
        label: r.label,
        unit: r.unit,
        min: value[r.metric]?.min,
        max: value[r.metric]?.max,
        enabled: value[r.metric]?.enabled ?? r.enabled ?? true,
      }))
      upsert(updatedRules)
    },
  })

  if (rLoading) return <StateSkeleton variant="table" count={8} />
  if (rError) return <StateError message="加载告警规则失败" />

  const data = rules ?? []

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Title order={4}>告警规则配置</Title>
        <Button size="sm" onClick={() => form.handleSubmit()} loading={upsertLoading}>
          保存
        </Button>
      </Group>

      {data.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          暂无告警规则
        </Text>
      )}

      {data.map((rule: any) => (
        <Paper key={rule.metric} p="sm" radius="md" withBorder mb="sm">
          <Group justify="space-between" mb="xs">
            <Text fw={500}>{rule.label}</Text>
            <form.Field name={`${rule.metric}.enabled`} defaultValue={rule.enabled}>
              {(field) => (
                <Switch
                  label={field.state.value ? '启用' : '禁用'}
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.checked)}
                  size="sm"
                />
              )}
            </form.Field>
          </Group>
          <Group grow>
            <form.Field name={`${rule.metric}.min`} defaultValue={rule.min}>
              {(field) => (
                <NumberInput
                  label={`下限 (${rule.unit})`}
                  value={field.state.value ?? ''}
                  onChange={(v) => field.handleChange(typeof v === 'number' ? v : undefined)}
                  size="xs"
                />
              )}
            </form.Field>
            <form.Field name={`${rule.metric}.max`} defaultValue={rule.max}>
              {(field) => (
                <NumberInput
                  label={`上限 (${rule.unit})`}
                  value={field.state.value ?? ''}
                  onChange={(v) => field.handleChange(typeof v === 'number' ? v : undefined)}
                  size="xs"
                />
              )}
            </form.Field>
          </Group>
        </Paper>
      ))}
    </div>
  )
}
