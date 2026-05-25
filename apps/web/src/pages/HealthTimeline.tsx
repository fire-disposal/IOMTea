import { Box, Container, Group, Paper, Select, Skeleton, Text } from '@mantine/core'
import { useState } from 'react'
import { useGet } from '../api/hooks'

interface M {
  metric: string
  displayName: string
  unit: string
}
function parseId() {
  return window.location.pathname.split('/patients/')[1]?.split('/')[0] || ''
}

export function HealthTimeline() {
  const pid = parseId()
  const { data: metrics } = useGet<M[]>('/data/metrics')
  const [selected, setSelected] = useState('heart_rate')
  const from = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: trend, isLoading } = useGet<{
    rows: { recordedAt: number; numericValue: number }[]
  }>('/data/raw', { patientId: pid, metric: selected, from, limit: 200 })

  if (isLoading)
    return (
      <Container py="md">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={24} mb="sm" />
        ))}
      </Container>
    )

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Select
          size="sm"
          data={(metrics ?? []).map((m) => ({
            value: m.metric,
            label: `${m.displayName} (${m.unit})`,
          }))}
          value={selected}
          onChange={(v) => setSelected(v ?? 'heart_rate')}
          w={200}
        />
      </Group>
      <Paper p="md" withBorder>
        {!trend?.rows?.length ? (
          <Text c="dimmed" ta="center">
            暂无数据
          </Text>
        ) : (
          <Group gap={0} align="flex-end" h={120}>
            {trend.rows.map((r, i) => {
              const maxV = Math.max(...trend.rows.map((t) => t.numericValue || 0), 1)
              return (
                <Box
                  key={i}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%',
                  }}
                >
                  <Text size="xs" c="dimmed">
                    {r.numericValue?.toFixed?.(1) ?? '-'}
                  </Text>
                  <Box
                    style={{
                      width: '80%',
                      height: `${Math.max(4, ((r.numericValue || 0) / maxV) * 100)}%`,
                      backgroundColor: 'var(--mantine-color-teal-5)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: 4,
                    }}
                  />
                </Box>
              )
            })}
          </Group>
        )}
      </Paper>
    </Container>
  )
}
