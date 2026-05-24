import {
  Badge,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { AccentPaper } from '../components/shared/AccentPaper'
import {
  IconAlertTriangle,
  IconUsers,
} from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { QueryGate } from '../components/shared/QueryGate'
import { StatsBar, type StatsBarItem } from '../components/shared/StatsBar'
import { trpc } from '../trpc'

export function DashboardPage() {
  const navigate = useNavigate()
  const patients = trpc.patient.list.useQuery({ pageSize: 100, status: 'active' })
  const alerts = trpc.alert.list.useQuery({ pageSize: 100 })

  const activeAlerts = (alerts.data ?? []).filter((a: any) => a.status === 'active').length

  const statsItems: StatsBarItem[] = [
    { label: '患者总数', value: patients.isError ? '加载失败' : patients.data?.length ?? 0, icon: <IconUsers size={20} />, color: 'matchaGreen' },
    { label: '活跃告警', value: alerts.isError ? '加载失败' : activeAlerts, icon: <IconAlertTriangle size={20} />, color: 'red' },
  ]

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="lg">
        工作台
      </Title>

      <StatsBar items={statsItems} cols={2} loading={patients.isLoading || alerts.isLoading} />

      <Paper p="md" radius="md" withBorder className="card-hover">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>最近告警</Text>
        </Group>
        <QueryGate
          isLoading={alerts.isLoading}
          isError={alerts.isError}
          data={alerts.data ?? []}
          errorMessage="加载告警失败"
          emptyMessage="暂无告警"
          skeletonCount={3}
        >
          {(data) => (
            <Stack gap="xs">
              {data.slice(0, 10).map((alert) => (
                <AccentPaper key={alert.id} p="xs" withBorder radius="sm" color={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'yellow' : 'blue'}>
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>{alert.metric}</Text>
                      <Text size="xs" c="dimmed">
                        {alert.value} {alert.unit} — {new Date(alert.recordedAt).toLocaleString('zh-CN')}
                      </Text>
                    </div>
                    <Badge
                      color={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'yellow' : 'blue'}
                      size="sm"
                    >
                      {alert.severity}
                    </Badge>
                  </Group>
                </AccentPaper>
              ))}
            </Stack>
          )}
        </QueryGate>
      </Paper>
    </Container>
  )
}
