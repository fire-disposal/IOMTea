import { Group, Paper, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core'
import { IconAlertTriangle, IconAmbulance, IconUsers } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { http } from '../api/client'

function StatCard({
  label,
  value,
  color,
  icon,
}: { label: string; value: number; color: string; icon: React.ReactNode }) {
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
  const [data, setData] = useState({ patientCount: 0, activeAlerts24h: 0, criticalAlerts: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    http
      .get('/dashboard/summary')
      .then((res) => {
        setData(res.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <Text p="md" c="dimmed">
        Loading...
      </Text>
    )

  return (
    <div style={{ padding: 24 }}>
      <Title order={2} mb="md">
        IOMTea Dashboard
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <StatCard
          label="在管患者"
          value={data.patientCount}
          color="teal"
          icon={<IconUsers size={14} />}
        />
        <StatCard
          label="24h 活跃告警"
          value={data.activeAlerts24h}
          color="orange"
          icon={<IconAlertTriangle size={14} />}
        />
        <StatCard
          label="严重告警"
          value={data.criticalAlerts}
          color="red"
          icon={<IconAmbulance size={14} />}
        />
      </SimpleGrid>
    </div>
  )
}
