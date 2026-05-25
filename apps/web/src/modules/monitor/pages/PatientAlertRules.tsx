import { Button, Group, NumberInput, Paper, Switch, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useForm } from '@tanstack/react-form'
import { trpc } from '../../../trpc'
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
  const utils = trpc.useUtils()
  const rules = trpc.alertRule.byPatient.useQuery({ patientId }, { enabled: !!patientId })
  const upsert = trpc.alertRule.upsert.useMutation({
    onSuccess: () => {
      notifications.show({ title: '已保存', message: '告警规则已更新', color: 'green' })
      utils.alertRule.byPatient.invalidate({ patientId })
    },
    onError: (err) => notifications.show({ title: '保存失败', message: err.message, color: 'red' }),
  })

  const form = useForm({
    defaultValues: {} as Record<string, { min?: number; max?: number; enabled: boolean }>,
    onSubmit: ({ value }) => {
      const updatedRules = (rules.data ?? []).map((r: any) => ({
        metric: r.metric,
        label: r.label,
        unit: r.unit,
        min: value[r.metric]?.min,
        max: value[r.metric]?.max,
        enabled: value[r.metric]?.enabled ?? r.enabled ?? true,
      }))
      upsert.mutate({ patientId, rules: updatedRules })
    },
  })

  if (rules.isLoading) return <StateSkeleton variant="table" count={8} />
  if (rules.isError) return <StateError message="加载告警规则失败" />

  const data = rules.data ?? []

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Title order={4}>告警规则配置</Title>
        <Button size="sm" onClick={() => form.handleSubmit()} loading={upsert.isPending}>
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
