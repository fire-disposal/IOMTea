import { ActionIcon, Badge, Container, Group, Paper, Text, Title } from '@mantine/core'
import { IconEye } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { useGet, usePost } from '../api/hooks'
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
  const navigate = useNavigate()

  const filtered = (alerts ?? []).filter((a) => a.status !== 'closed' && a.status !== 'resolved')

  if (isLoading)
    return <StateSkeleton lines={4} />

  return (
    <Container py="md">
      <Title order={2} mb="md">
        告警看板
      </Title>
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
              {a.status === 'new' && (
                <Badge
                  size="xs"
                  style={{ cursor: 'pointer' }}
                  color="green"
                  onClick={() => acknowledge.mutate({ id: a.id, action: 'acknowledge' } as any)}
                >
                  确认
                </Badge>
              )}
              <ActionIcon
                variant="light"
                size="sm"
                onClick={() => navigate({ to: `/patients/${a.patientId}/alerts` })}
              >
                <IconEye size={14} />
              </ActionIcon>
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
