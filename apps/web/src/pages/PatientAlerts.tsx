import { Badge, Container, Group, Paper, SegmentedControl, Text } from '@mantine/core'
import { useGet, usePatch } from '../api/hooks'
import { parsePatientId } from '../lib/path'
import { StateSkeleton } from '../components/StateComponents'

interface A {
  id: string
  metric: string
  value: unknown
  unit: string | null
  severity: string | null
  status: string | null
}

export function PatientAlerts() {
  const pid = parsePatientId()
  const { data: alerts, isLoading } = useGet<A[]>('/alerts', { patientId: pid, pageSize: 100 })

  if (isLoading)
    return <StateSkeleton lines={4} />

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
