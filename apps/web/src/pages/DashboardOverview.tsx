import { Container, SimpleGrid, Paper, Text, Group, Badge, Stack, ThemeIcon } from '@mantine/core'
import { trpc } from '../trpc'

export function DashboardOverview() {
  const { data, isLoading } = trpc.dashboard.summary.useQuery(undefined, { refetchInterval: 10000 })

  if (isLoading || !data) {
    return (
      <Container py="xl">
        <Text c="dimmed" ta="center">加载中...</Text>
      </Container>
    )
  }

  const stats = [
    { label: '患者总数', value: data.patients.total, sub: `${data.patients.active} 活跃`, color: 'blue' as const },
    { label: '设备总数', value: data.devices.total, sub: `${data.devices.active} 活跃`, color: 'teal' as const },
    { label: '活跃告警', value: data.alerts.active, sub: `${data.alerts.critical} 严重`, color: data.alerts.critical > 0 ? 'red' as const : 'orange' as const },
  ]

  return (
    <Container size="xl" py="md">
      <Text fw={700} mb="md" size="lg">系统概览</Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="xl">
        {stats.map((s) => (
          <Paper key={s.label} p="md" withBorder>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">{s.label}</Text>
              <Text size="xl" fw={700} c={s.color}>{s.value}</Text>
              <Text size="xs" c="dimmed">{s.sub}</Text>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>

      <Text fw={600} mb="sm">Ward 状态</Text>
      {data.wards.length === 0 ? (
        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed" ta="center">暂无运行中的 Ward</Text>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {data.wards.map((w) => (
            <Paper key={w.id} p="sm" withBorder>
              <Group justify="space-between" mb={4}>
                <Text fw={600} size="sm">{w.name}</Text>
                <Badge color={w.running ? 'green' : 'gray'} size="sm" variant="filled">
                  {w.running ? '运行中' : '暂停'}
                </Badge>
              </Group>
              <Group gap="md">
                <Text size="xs" c="dimmed">患者 {w.patientCount}</Text>
                <Text size="xs" c="dimmed">{w.speed}×</Text>
                <Text size="xs" c="dimmed">tick {w.tick}</Text>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      )}
    </Container>
  )
}
