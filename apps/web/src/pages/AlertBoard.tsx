import {
  ActionIcon,
  Badge,
  Container,
  Group,
  Paper,
  Select,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconEye } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useGet, usePatch, usePost } from '../api/hooks'
import { StateSkeleton } from '../components/StateComponents'

interface Alert {
  id: string
  patientId: string
  metric: string
  value: unknown
  unit: string | null
  severity: string | null
  status: string | null
}

export function AlertBoard() {
  const { data: alerts, isLoading } = useGet<Alert[]>('/alerts', { pageSize: 100 })
  const acknowledge = usePost('/alerts/:id')
  const resolveAlert = usePatch('/alerts/:id')
  const closeAlert = usePost('/alerts/:id/close')
  const navigate = useNavigate()
  const [filterPatient, setFilterPatient] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null)
  const { data: patients } = useGet<{ id: string; name: string }[]>('/patients', { pageSize: 200 })

  const filtered = (alerts ?? []).filter((a) => {
    if (filterPatient && a.patientId !== filterPatient) return false
    if (filterSeverity && a.severity !== filterSeverity) return false
    return a.status !== 'closed' && a.status !== 'resolved'
  })

  if (isLoading) return <StateSkeleton lines={4} />

  return (
    <Container py="md">
      <Title order={2} mb="md">
        告警看板
      </Title>
      <Group mb="md">
        <Select
          size="xs"
          placeholder="筛选患者"
          data={(patients || []).map((p) => ({ value: p.id, label: p.name }))}
          value={filterPatient}
          onChange={setFilterPatient}
          clearable
          w={200}
        />
        <Select
          size="xs"
          placeholder="筛选级别"
          data={[
            { value: 'critical', label: '危急' },
            { value: 'warning', label: '警告' },
            { value: 'info', label: '提示' },
          ]}
          value={filterSeverity}
          onChange={setFilterSeverity}
          clearable
          w={120}
        />
      </Group>
      <Text size="xs" c="dimmed" mb="xs">
        共{filtered.length}条活跃告警
      </Text>
      {filtered.map((a) => (
        <Paper key={a.id} p="sm" mb="xs" withBorder>
          <Group justify="space-between">
            <Group gap="xs">
              <Badge color={a.severity === 'critical' ? 'red' : 'yellow'} size="xs">
                {a.severity}
              </Badge>
              <Text size="sm">
                {a.metric}: {String(a.value ?? '-')} {a.unit}
              </Text>
            </Group>
            <Group gap="xs">
              {(a.status === 'new' || a.status === 'active') && (
                <Badge
                  size="xs"
                  style={{ cursor: 'pointer' }}
                  color="green"
                  onClick={() => acknowledge.mutate({ id: a.id, action: 'acknowledge' })}
                >
                  确认
                </Badge>
              )}
              {a.status === 'acknowledged' && (
                <Group gap="xs">
                  <Badge
                    size="xs"
                    style={{ cursor: 'pointer' }}
                    color="blue"
                    onClick={() => resolveAlert.mutate({ id: a.id, action: 'resolve' })}
                  >
                    解决
                  </Badge>
                  <Badge
                    size="xs"
                    style={{ cursor: 'pointer' }}
                    color="gray"
                    onClick={() => closeAlert.mutate(a.id)}
                  >
                    关闭
                  </Badge>
                </Group>
              )}
              <Tooltip label="查看患者告警" withArrow>
                <ActionIcon
                  variant="light"
                  size="sm"
                  onClick={() => navigate({ to: `/patients/${a.patientId}/alerts` })}
                >
                  <IconEye size={14} />
                </ActionIcon>
              </Tooltip>
              <Badge size="xs" variant="light">
                {a.status}
              </Badge>
            </Group>
          </Group>
        </Paper>
      ))}
    </Container>
  )
}
