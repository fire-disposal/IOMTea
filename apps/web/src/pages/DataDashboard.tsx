import { Badge, Box, Group, Paper, SimpleGrid, Skeleton, Text, ThemeIcon, Title } from '@mantine/core'
import { AccentPaper } from '../components/shared/AccentPaper'
import { IconAlertTriangle, IconHeart, IconLungs, IconUsers } from '@tabler/icons-react'
import { useMemo } from 'react'

import { trpc } from '../trpc'
import { useRealtime } from '../hooks/useRealtime'

function StatCard({ label, value, unit, color, icon }: { label: string; value: string | number; unit?: string; color: string; icon: React.ReactNode }) {
  return (
    <AccentPaper p="md" withBorder color={color}>
      <Group gap="xs" mb={4}>
        <ThemeIcon size="sm" color={color} variant="light">{icon}</ThemeIcon>
        <Text size="xs" c="dimmed">{label}</Text>
      </Group>
      <Text fw={700} fz={28}>{value}</Text>
      {unit && <Text size="xs" c="dimmed">{unit}</Text>}
    </AccentPaper>
  )
}


export function DataDashboard() {
  const patients = trpc.patient.list.useQuery({ pageSize: 100, status: 'active' })
  const alerts = trpc.alert.list.useQuery({ pageSize: 50, status: 'active' }, { refetchInterval: 10000 })
  const patientIds = useMemo(() => (patients.data ?? []).slice(0, 8).map((p: any) => p.id), [patients.data])
  const latestVitals = trpc.useQueries((t) => patientIds.map((pid: string) => t.data.latest({ patientId: pid })))
  useRealtime(undefined, undefined, patientIds[0])

  const activeAlerts = (alerts.data ?? []).filter((a: any) => a.status === 'active' || a.status === 'new')
  const patientCount = patients.data?.length ?? 0

  return (
    <Box bg="matchaGreen.0" mih="calc(100vh - 56px)" py="md" px="xl">
      <Group justify="space-between" mb="md">
        <Title order={3}>数据监控大屏</Title>
        <Text size="xs" c="dimmed">{patientCount} 位患者 · {activeAlerts.length} 条活跃告警</Text>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
        <StatCard label="在管患者" value={patientCount} color="matchaGreen" icon={<IconUsers size={14} />} />
        <StatCard label="活跃告警" value={activeAlerts.length} color="red" icon={<IconAlertTriangle size={14} />} />
        {latestVitals.map((v) => {
          const hr = (v.data as any[])?.find((m: any) => m.metric === 'heart_rate')?.value
          return hr != null ? <StatCard key="hr" label="平均心率" value={hr.toFixed(0)} unit="bpm" color="red" icon={<IconHeart size={14} />} /> : null
        }).find(Boolean)}
        {latestVitals.map((v) => {
          const spo2 = (v.data as any[])?.find((m: any) => m.metric === 'spo2')?.value
          return spo2 != null ? <StatCard key="spo2" label="平均血氧" value={spo2.toFixed(0)} unit="%" color="blue" icon={<IconLungs size={14} />} /> : null
        }).find(Boolean)}
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
            {(patients.data ?? []).slice(0, 10).map((p: any) => {
              const vitals = latestVitals.find((v) => v.data?.some((m: any) => m.metric === 'heart_rate'))
              const hr = (vitals?.data as any[])?.find((m: any) => m.metric === 'heart_rate')
              return (
                <Paper key={p.id} p="xs" withBorder>
                  <Group gap={4}>
                    <Text size="xs" fw={500}>{p.name}</Text>
                    {hr?.value != null && <Badge size="xs" color="matchaGreen" variant="light">{hr.value} bpm</Badge>}
                  </Group>
                </Paper>
              )
            })}
          </SimpleGrid>
        </Paper>
      </SimpleGrid>
    </Box>
  )
}