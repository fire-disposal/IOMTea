import {
  Box,
  Container,
  Group,
  Paper,
  Select,
  Skeleton,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { IconChartLine } from '@tabler/icons-react'
import { useState } from 'react'
import { useGet } from '../api/hooks'

interface M {
  metric: string
  displayName: string
  unit: string
  defaultChart: string
}

export function DataDashboard() {
  const { data: metrics } = useGet<M[]>('/data/metrics')
  const [selected, setSelected] = useState('heart_rate')
  const from = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: trend, isLoading } = useGet<{ rows: { bucket: string; value: number }[] }>(
    '/data/aggregate',
    {
      patientId: '00000000-0000-0000-0000-000000000000',
      metric: selected,
      interval: 'day',
      fn: 'avg',
      from,
    },
  )

  const def = (metrics ?? []).find((m) => m.metric === selected)

  return (
    <Container py="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light">
            <IconChartLine size={14} />
          </ThemeIcon>
          <Title order={2}>数据监控</Title>
        </Group>
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
        {isLoading ? (
          <Skeleton height={120} />
        ) : !trend?.rows?.length ? (
          <Text c="dimmed" ta="center">
            暂无数据
          </Text>
        ) : (
          <Group gap={0} align="flex-end" h={120}>
            {trend.rows.map((r, i) => {
              const maxV = Math.max(...trend.rows.map((t) => t.value || 0), 1)
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
                    {r.value?.toFixed?.(1) ?? '-'}
                  </Text>
                  <Box
                    style={{
                      width: '80%',
                      height: `${Math.max(4, ((r.value || 0) / maxV) * 100)}%`,
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
