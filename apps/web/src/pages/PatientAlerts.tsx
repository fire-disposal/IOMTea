import { Badge, Container, Group, Paper, SegmentedControl, Skeleton, Text } from '@mantine/core'
import { useGet, usePatch } from '../api/hooks'

interface A {
  id: string
  metric: string
  value: unknown
  unit: string | null
  severity: string | null
  status: string | null
}
function parseId() {
  return window.location.pathname.split('/patients/')[1]?.split('/')[0] || ''
}

export function PatientAlerts() {
  const pid = parseId()
  const { data: alerts, isLoading } = useGet<A[]>('/alerts', { patientId: pid, pageSize: 100 })

  if (isLoading)
    return (
      <Container py="md">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={24} mb="sm" />
        ))}
      </Container>
    )

  return (
    <Container py="md">
      {(alerts ?? [])
        .filter((a) => a.status !== 'closed')
        .map((a) => (
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
              <Badge size="xs" variant="light">
                {a.status}
              </Badge>
            </Group>
          </Paper>
        ))}
    </Container>
  )
}
