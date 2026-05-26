import { Group, Paper, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core'
import { IconAlertTriangle, IconAmbulance, IconCoin, IconUsers } from '@tabler/icons-react'
import { useGet } from '../api/hooks'
import { StateSkeleton } from '../components/StateComponents'

function StatCard({
  label,
  value,
  color,
  icon,
}: { label: string; value: number | string; color: string; icon: React.ReactNode }) {
  return (
    <Paper p="md" withBorder>
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
}

export function DashboardPage() {
  const { data, isLoading } = useGet<{
    patientCount: number
    activeAlerts24h: number
    criticalAlerts: number
  }>('/dashboard/summary')
  const { data: me } = useGet<{ credit: number }>('/users/me')

  if (isLoading)
    return <StateSkeleton lines={3} />

  return (
    <div style={{ padding: 24 }}>
      <Title order={2} mb="md">
        IOMTea Dashboard
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 4 }}>
        <StatCard
          label="在管患者"
          value={data?.patientCount ?? 0}
          color="teal"
          icon={<IconUsers size={14} />}
        />
        <StatCard
          label="24h 活跃告警"
          value={data?.activeAlerts24h ?? 0}
          color="orange"
          icon={<IconAlertTriangle size={14} />}
        />
        <StatCard
          label="严重告警"
          value={data?.criticalAlerts ?? 0}
          color="red"
          icon={<IconAmbulance size={14} />}
        />
        <StatCard
          label="当前积分"
          value={me?.credit ?? 0}
          color="yellow"
          icon={<IconCoin size={14} />}
        />
      </SimpleGrid>
    </div>
  )
}
