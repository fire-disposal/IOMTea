import { Box, Container, Group, Paper, Select, Skeleton, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

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
  const [metrics, setMetrics] = useState<M[]>([])
  const [selected, setSelected] = useState('heart_rate')
  const [trend, setTrend] = useState<{ recordedAt: number; numericValue: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    http.get('/data/metrics').then((r) => {
      setMetrics(r.data as M[])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selected) return
    http
      .get('/data/raw', {
        params: {
          patientId: pid,
          metric: selected,
          from: new Date(Date.now() - 7 * 86400000).toISOString(),
          limit: 200,
        },
      })
      .then((r) => setTrend((r.data as any).rows ?? []))
  }, [pid, selected])

  if (loading)
    return (
      <Container py="md">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={24} mb="sm" />
        ))}
      </Container>
    )

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Select
          size="sm"
          data={metrics.map((m) => ({ value: m.metric, label: `${m.displayName} (${m.unit})` }))}
          value={selected}
          onChange={(v) => setSelected(v ?? 'heart_rate')}
          w={200}
        />
      </Group>
      <Paper p="md" withBorder>
        {trend.length === 0 ? (
          <Text c="dimmed" ta="center">
            暂无数据
          </Text>
        ) : (
          <Group gap={0} align="flex-end" h={120}>
            {trend.map((r, i) => {
              const maxV = Math.max(...trend.map((t) => t.numericValue || 0), 1)
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
    </div>
  )
}
