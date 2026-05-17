import {
  Badge,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconCalendar,
  IconChartLine,
  IconChevronRight,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { QueryGate } from '../components/shared/QueryGate'
import { StatsBar, type StatsBarItem } from '../components/shared/StatsBar'
import { trpc } from '../trpc'

export function DashboardPage() {
  const navigate = useNavigate()
  const patients = trpc.patient.list.useQuery({ pageSize: 100, status: 'active' })
  const alerts = trpc.alert.list.useQuery({ pageSize: 100 })

  const activeAlerts = (alerts.data ?? []).filter((a: any) => a.status === 'active').length

  const statsItems: StatsBarItem[] = [
    { label: '患者总数', value: patients.data?.length ?? 0, icon: <IconUsers size={20} />, color: 'matchaGreen' },
    { label: '活跃告警', value: activeAlerts, icon: <IconAlertTriangle size={20} />, color: 'red' },
  ]

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="lg">
        工作台
      </Title>

      <StatsBar items={statsItems} cols={2} />

      <Paper p="md" radius="md" withBorder className="card-hover">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>最近告警</Text>
          <Button variant="subtle" size="xs" rightSection={<IconChevronRight size={14} />} onClick={() => navigate('/alerts')}>
            查看全部
          </Button>
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
                <Paper key={alert.id} p="xs" withBorder radius="sm">
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
                </Paper>
              ))}
            </Stack>
          )}
        </QueryGate>
      </Paper>
    </Container>
  )
}
