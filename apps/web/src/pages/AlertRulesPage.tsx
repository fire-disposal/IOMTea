import { Button, Container, Group, Loader, NumberInput, Paper, Select, Stack, Switch, Text, Title, Alert } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo } from 'react'
import { trpc } from '../trpc'
import { usePatientStore } from '../store/patients'

export function AlertRulesPage() {
  const selectedPatient = usePatientStore((s) => s.selectedPatientId)
  const selectPatient = usePatientStore((s) => s.selectPatient)
  const patients = usePatientStore((s) => s.patients)

  const patientOptions = useMemo(() => patients.map((p) => ({ value: p.id, label: p.name })), [patients])

  const rulesQuery = trpc.alertRule.byPatient.useQuery({ patientId: selectedPatient || '' }, { enabled: !!selectedPatient })

  const upsertMutation = trpc.alertRule.upsert.useMutation({
    onSuccess: () => notifications.show({ title: '已保存', message: '告警阈值已更新', color: 'green' }),
    onError: (err: any) => notifications.show({ title: '保存失败', message: err.message, color: 'red' }),
  })

  const form = useForm<{ rules: { metric: string; label: string; unit: string; min?: number; max?: number; enabled: boolean }[] }>({
    initialValues: { rules: [] },
  })

  useEffect(() => {
    if (rulesQuery.data) form.setValues({ rules: structuredClone(rulesQuery.data as any) })
  }, [rulesQuery.data])

  const handlePatientChange = (id: string | null) => {
    if (form.isDirty() && !confirm('未保存的更改将丢失，确定切换患者吗？')) return
    selectPatient(id)
  }

  return (
    <Container size="md" py="md">
      <Title order={4} mb="md">告警阈值配置</Title>
      <Select data={patientOptions} value={selectedPatient} onChange={handlePatientChange} placeholder="选择患者" searchable clearable mb="md" />

      {!selectedPatient && <Paper p="xl" withBorder><Text ta="center" c="dimmed">请选择患者以配置告警阈值</Text></Paper>}
      {selectedPatient && rulesQuery.isLoading && <Paper p="xl" withBorder><Group justify="center"><Loader size="sm" /><Text c="dimmed">加载阈值配置...</Text></Group></Paper>}
      {selectedPatient && rulesQuery.isError && <Alert color="red" title="加载失败" variant="light">{rulesQuery.error?.message || '无法加载阈值配置'}</Alert>}

      {form.values.rules.length > 0 && (
        <form onSubmit={form.onSubmit((v) => upsertMutation.mutate({ patientId: selectedPatient!, rules: v.rules }))}>
          <Paper p="md" withBorder mb="md">
            <Stack gap="sm">
              {form.values.rules.map((rule, i) => (
                <Paper key={rule.metric} p="sm" withBorder bg="gray.0">
                  <Group justify="space-between" wrap="wrap">
                    <Switch label={rule.label} checked={rule.enabled} onChange={(e) => form.setFieldValue(`rules.${i}.enabled`, e.currentTarget.checked)} />
                    <Group gap="xs">
                      {rule.min !== undefined && <NumberInput label="下限" value={rule.min ?? ''} onChange={(v) => form.setFieldValue(`rules.${i}.min`, typeof v === 'number' ? v : undefined)} min={0} step={1} w={100} size="xs" disabled={!rule.enabled} />}
                      {rule.max !== undefined && <NumberInput label="上限" value={rule.max ?? ''} onChange={(v) => form.setFieldValue(`rules.${i}.max`, typeof v === 'number' ? v : undefined)} min={0} step={1} w={100} size="xs" disabled={!rule.enabled} />}
                      <Text size="xs" c="dimmed" pt="lg" miw={50}>{rule.unit}</Text>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Paper>
          <Group justify="flex-end">
            <Button type="submit" loading={upsertMutation.isPending} disabled={!form.isDirty()}>保存配置</Button>
          </Group>
        </form>
      )}
    </Container>
  )
}
