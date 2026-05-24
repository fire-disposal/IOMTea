import { Badge, Box, Group, Paper, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core'
import { AccentPaper } from '../components/shared/AccentPaper'
import { IconAlertTriangle, IconUsers } from '@tabler/icons-react'
import { trpc } from '../trpc'
import { StateSkeleton, StateError } from '../components/shared/StateComponents'

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
  return (
    <AccentPaper p="md" withBorder color={color}>
      <Group gap="xs" mb={4}>
        <ThemeIcon size="sm" color={color} variant="light">{icon}</ThemeIcon>
        <Text size="xs" c="dimmed">{label}</Text>
      </Group>
      <Text fw={700} fz={28}>{value}</Text>
    </AccentPaper>
  )
}

export function DataDashboard() {
  const patients = trpc.patient.list.useQuery({ pageSize: 100, status: 'active' })
  const alerts = trpc.alert.list.useQuery({ pageSize: 50 }, { refetchInterval: 10000 })

  const isLoading = patients.isLoading || alerts.isLoading
  const isError = patients.isError || alerts.isError

  if (isLoading) return <Box py="md" px="xl"><StateSkeleton variant="chart" /></Box>
  if (isError) return <Box py="md" px="xl"><StateError message="加载数据失败" onRetry={() => { patients.refetch(); alerts.refetch() }} /></Box>

  const activeAlerts = (alerts.data ?? []).filter((a: any) => a.status !== 'closed' && a.status !== 'resolved')
  const patientCount = patients.data?.length ?? 0
  const criticalCount = activeAlerts.filter((a: any) => a.severity === 'critical').length

  return (
    <Box bg="matchaGreen.0" mih="calc(100vh - 56px)" py="md" px="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>数据监控大屏</Title>
        <Text size="xs" c="dimmed">{patientCount} 位患者 · {activeAlerts.length} 条活跃告警</Text>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="md">
        <StatCard label="在管患者" value={patientCount} color="matchaGreen" icon={<IconUsers size={14} />} />
        <StatCard label="活跃告警" value={activeAlerts.length} color="red" icon={<IconAlertTriangle size={14} />} />
        <StatCard label="严重告警" value={criticalCount} color="red" icon={<IconAlertTriangle size={14} />} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} mb="md">
        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed" mb="sm">实时告警流</Text>
          {activeAlerts.length === 0 ? <Text size="sm" c="dimmed" ta="center" mt="md">暂无活跃告警</Text> : (
            activeAlerts.slice(0, 10).map((a: any) => (
              <Group key={a.id} gap="xs" mb={6}>
                <Badge size="xs" color={a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'yellow' : 'blue'} variant="filled">{a.severity}</Badge>
                <Text size="xs">{a.metric}: {a.value} {a.unit}</Text>
                <Text size="xs" c="dimmed">{new Date(a.recordedAt).toLocaleTimeString('zh-CN')}</Text>
              </Group>
            ))
          )}
        </Paper>

        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed" mb="sm">患者概览</Text>
          <SimpleGrid cols={2} spacing="xs">
            {(patients.data ?? []).slice(0, 10).map((p: any) => (
              <Paper key={p.id} p="xs" withBorder>
                <Group gap={4}>
                  <Text size="xs" fw={500}>{p.name}</Text>
                  <Badge size="xs" color={p.status === 'active' ? 'matchaGreen' : 'gray'} variant="light">{p.status}</Badge>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        </Paper>
      </SimpleGrid>
    </Box>
  )
}
