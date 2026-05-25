import { Badge, Container, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { AccentPaper } from '../components/shared/AccentPaper'
import { IconAlertTriangle, IconUsers } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { QueryGate } from '../components/shared/QueryGate'
import { StatsBar, type StatsBarItem } from '../components/shared/StatsBar'
import { api } from '../api/client'
import { useState, useEffect, useCallback } from 'react'

export function DashboardPage() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [pLoading, setPLoading] = useState(true)
  const [pError, setPError] = useState(false)
  const [aLoading, setALoading] = useState(true)
  const [aError, setAError] = useState(false)

  const fetchPatients = useCallback(async () => {
    setPLoading(true)
    try {
      const { data } = await api.GET('/patients', { params: { query: { pageSize: 100, status: 'active' } } })
      setPatients(data ?? [])
      setPError(false)
    } catch {
      setPError(true)
    } finally {
      setPLoading(false)
    }
  }, [])

  const fetchAlerts = useCallback(async () => {
    setALoading(true)
    try {
      const { data } = await api.GET('/alerts', { params: { query: { pageSize: 100 } } })
      setAlerts(data ?? [])
      setAError(false)
    } catch {
      setAError(true)
    } finally {
      setALoading(false)
    }
  }, [])

  useEffect(() => { fetchPatients() }, [fetchPatients])
  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const activeAlerts = alerts.filter((a: any) => a.status === 'active').length

  const statsItems: StatsBarItem[] = [
    {
      label: '患者总数',
      value: pError ? '加载失败' : patients.length,
      icon: <IconUsers size={20} />,
      color: 'matchaGreen',
    },
    {
      label: '活跃告警',
      value: aError ? '加载失败' : activeAlerts,
      icon: <IconAlertTriangle size={20} />,
      color: 'red',
    },
  ]

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="lg">
        工作台
      </Title>

      <StatsBar items={statsItems} cols={2} loading={pLoading || aLoading} />

      <Paper p="md" radius="md" withBorder className="card-hover">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>最近告警</Text>
        </Group>
        <QueryGate
          isLoading={aLoading}
          isError={aError}
          data={alerts}
          errorMessage="加载告警失败"
          emptyMessage="暂无告警"
          skeletonCount={3}
        >
          {(data) => (
            <Stack gap="xs">
              {data.slice(0, 10).map((alert) => (
                <AccentPaper
                  key={alert.id}
                  p="xs"
                  withBorder
                  radius="sm"
                  color={
                    alert.severity === 'critical'
                      ? 'red'
                      : alert.severity === 'warning'
                        ? 'yellow'
                        : 'blue'
                  }
                >
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>
                        {alert.metric}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {String(alert.value ?? '-')} {alert.unit} —{' '}
                        {new Date(alert.recordedAt).toLocaleString('zh-CN')}
                      </Text>
                    </div>
                    <Badge
                      color={
                        alert.severity === 'critical'
                          ? 'red'
                          : alert.severity === 'warning'
                            ? 'yellow'
                            : 'blue'
                      }
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
