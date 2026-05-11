import {
  Button,
  Container,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { trpc } from '../trpc'

export function AlertRulesPage() {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)

  const patientList = trpc.patient.list.useQuery({ pageSize: 100 })

  const rulesQuery = trpc.alertRule.byPatient.useQuery(
    { patientId: selectedPatient || '' },
    { enabled: !!selectedPatient },
  )

  const upsertMutation = trpc.alertRule.upsert.useMutation({
    onSuccess: () =>
      notifications.show({ title: '已保存', message: '告警阈值已更新', color: 'green' }),
    onError: (err: any) =>
      notifications.show({ title: '保存失败', message: err.message, color: 'red' }),
  })

  const [editingRules, setEditingRules] = useState<any[]>([])

  useEffect(() => {
    if (rulesQuery.data) {
      setEditingRules(JSON.parse(JSON.stringify(rulesQuery.data)))
    }
  }, [rulesQuery.data])

  const patientOptions = useMemo(
    () =>
      (patientList.data || []).map((p: any) => ({
        value: p.id,
        label: p.name,
      })),
    [patientList.data],
  )

  const handleSave = () => {
    if (!selectedPatient) return
    upsertMutation.mutate({
      patientId: selectedPatient,
      rules: editingRules,
    })
  }

  const updateRule = (index: number, field: string, value: any) => {
    setEditingRules((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  return (
    <Container size="md" py="md">
      <Title order={4} mb="md">
        告警阈值配置
      </Title>

      <Group mb="md">
        <Select
          data={patientOptions}
          value={selectedPatient}
          onChange={setSelectedPatient}
          placeholder="选择患者"
          searchable
          clearable
          style={{ width: 200 }}
        />
      </Group>

      {!selectedPatient && (
        <Paper p="xl" withBorder>
          <Text ta="center" c="dimmed">
            请选择患者以配置告警阈值
          </Text>
        </Paper>
      )}

      {selectedPatient && rulesQuery.isLoading && (
        <Paper p="xl" withBorder>
          <Group justify="center">
            <Loader size="sm" />
            <Text c="dimmed">加载阈值配置...</Text>
          </Group>
        </Paper>
      )}

      {selectedPatient && !rulesQuery.isLoading && editingRules.length === 0 && (
        <Paper p="xl" withBorder>
          <Text ta="center" c="dimmed">
            该患者暂无可配置的阈值规则
          </Text>
        </Paper>
      )}

      {editingRules.length > 0 && (
        <>
          <Paper p="md" withBorder mb="md">
            <Stack gap="sm">
              {editingRules.map((rule, i) => (
                <Paper key={rule.metric} p="sm" withBorder bg="gray.0">
                  <Group justify="space-between" wrap="wrap">
                    <Group gap="xs">
                      <Switch
                        checked={rule.enabled}
                        onChange={(e) => updateRule(i, 'enabled', e.currentTarget.checked)}
                        size="sm"
                      />
                      <Text fw={500} style={{ minWidth: 80 }}>
                        {rule.label}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      {rule.min !== undefined && (
                        <NumberInput
                          label="下限"
                          value={rule.min ?? ''}
                          onChange={(v) =>
                            updateRule(i, 'min', typeof v === 'number' ? v : undefined)
                          }
                          min={0}
                          step={1}
                          style={{ width: 100 }}
                          size="xs"
                          disabled={!rule.enabled}
                        />
                      )}
                      {rule.max !== undefined && (
                        <NumberInput
                          label="上限"
                          value={rule.max ?? ''}
                          onChange={(v) =>
                            updateRule(i, 'max', typeof v === 'number' ? v : undefined)
                          }
                          min={0}
                          step={1}
                          style={{ width: 100 }}
                          size="xs"
                          disabled={!rule.enabled}
                        />
                      )}
                      <Text size="xs" c="dimmed" pt="lg" style={{ minWidth: 50 }}>
                        {rule.unit}
                      </Text>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Paper>

          <Group justify="flex-end">
            <Button onClick={handleSave} loading={upsertMutation.isPending}>
              保存配置
            </Button>
          </Group>
        </>
      )}
    </Container>
  )
}
