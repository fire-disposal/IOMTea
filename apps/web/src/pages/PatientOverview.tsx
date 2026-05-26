import { Paper, SimpleGrid, Text, Title } from '@mantine/core'
import { useGet } from '../api/hooks'

interface LatestItem {
  metric: string
  value: unknown
  unit: string | null
  recordedAt: number | null
}

interface AlertItem {
  id: string
  severity: string
  metric: string
  value: unknown
  recordedAt: string
}

export function PatientOverview({
  patientId,
  latest,
}: { patientId: string; latest: LatestItem[] | null }) {
  const { data: recentAlerts } = useGet<AlertItem[]>('/data/raw', {
    patientId,
    kind: 'alert',
    limit: 5,
  })

  return (
    <>
      <Title order={4} mb="sm">
        最近体征
      </Title>
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
        {(latest ?? []).map((m) => (
          <Paper key={m.metric} p="xs" withBorder>
            <Text size="xs" c="dimmed">
              {m.metric}
            </Text>
            <Text fw={600}>
              {String(m.value ?? '-')} {m.unit ?? ''}
            </Text>
          </Paper>
        ))}
        {(!latest || latest.length === 0) && (
          <Text size="sm" c="dimmed">
            暂无体征数据
          </Text>
        )}
      </SimpleGrid>

      <Title order={4} mb="sm">
        最近告警
      </Title>
      {(recentAlerts ?? []).length === 0 ? (
        <Text size="sm" c="dimmed">
          暂无告警
        </Text>
      ) : (
        (recentAlerts ?? []).map((a) => (
          <Paper key={a.id} p="xs" mb="xs" withBorder>
            <Text size="sm">
              {a.metric}: {String(a.value)} — {a.severity}
            </Text>
            <Text size="xs" c="dimmed">
              {new Date(a.recordedAt).toLocaleString()}
            </Text>
          </Paper>
        ))
      )}
    </>
  )
}
