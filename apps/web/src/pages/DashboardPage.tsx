import { Container, Group, Paper, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core'
import { IconAlertTriangle, IconAmbulance, IconCoin, IconUsers } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useGet } from '../api/hooks'
import { StateSkeleton } from '../components/StateComponents'
import { useRealtime } from '../hooks/useRealtime'

function StatCard({
  label,
  value,
  color,
  icon,
  to,
}: { label: string; value: number | string; color: string; icon: React.ReactNode; to?: string }) {
  const content = (
    <Paper p="md" withBorder className="card-hover">
      <Group gap="xs" mb={4}>
        <ThemeIcon size="sm" color={color} variant="light">
          {icon}
        </ThemeIcon>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
      </Group>
      <Text fw={700} fz={28}>
        {value}
      </Text>
    </Paper>
  )
  if (to) {
    return (
      <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
        {content}
      </Link>
    )
  }
  return content
}

export function DashboardPage() {
  const { data, isLoading } = useGet<{
    patientCount: number
    activeAlerts24h: number
    criticalAlerts: number
  }>('/dashboard/summary')
  const { data: me } = useGet<{ credit: number }>('/users/me')

  const [liveVitals, setLiveVitals] = useState<
    Record<string, { metric: string; value: number; unit: string | null }>
  >({})
  useRealtime({
    onVitals: (data) => {
      setLiveVitals((prev) => {
        const next = { ...prev }
        data.metrics.forEach((m) => {
          next[m.metric] = m
        })
        return next
      })
    },
  })

  if (isLoading) return <StateSkeleton lines={3} />

  return (
    <Container py="md">
      <Title order={2} mb="xs">
        工作台
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 4 }}>
        <StatCard
          label="在管患者"
          value={data?.patientCount ?? 0}
          color="teal"
          icon={<IconUsers size={14} />}
          to="/patients"
        />
        <StatCard
          label="24h 活跃告警"
          value={data?.activeAlerts24h ?? 0}
          color="orange"
          icon={<IconAlertTriangle size={14} />}
          to="/alerts"
        />
        <StatCard
          label="严重告警"
          value={data?.criticalAlerts ?? 0}
          color="red"
          icon={<IconAmbulance size={14} />}
          to="/alerts"
        />
        <StatCard
          label="当前积分"
          value={me?.credit ?? 0}
          color="yellow"
          icon={<IconCoin size={14} />}
        />
      </SimpleGrid>
      <Paper p="md" withBorder mt="md">
        <Text fw={600} mb="xs">
          实时体征
        </Text>
        {Object.keys(liveVitals).length === 0 ? (
          <Text size="sm" c="dimmed">
            等待实时数据...
          </Text>
        ) : (
          <Group gap="md">
            {Object.entries(liveVitals).map(([k, v]) => (
              <Paper key={k} p="xs" withBorder>
                <Text size="xs" c="dimmed">
                  {k}
                </Text>
                <Text fw={600}>
                  {v.value} {v.unit ?? ''}
                </Text>
              </Paper>
            ))}
          </Group>
        )}
      </Paper>
    </Container>
  )
}
