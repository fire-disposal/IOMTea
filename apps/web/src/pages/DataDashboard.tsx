import { Badge, Box, Group, Paper, Select, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core'
import { AccentPaper } from '../components/shared/AccentPaper'
import { IconAlertTriangle, IconUsers, IconChartLine } from '@tabler/icons-react'
import { api } from '../api/client'
import { StateSkeleton, StateError } from '../components/shared/StateComponents'
import { useState, useEffect, useCallback, useRef } from 'react'

function StatCard({
  label,
  value,
  color,
  icon,
}: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
  return (
    <AccentPaper p="md" withBorder color={color}>
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
    </AccentPaper>
  )
}

export function DataDashboard() {
  const [patients, setPatients] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [pLoading, setPLoading] = useState(true)
  const [pError, setPError] = useState(false)
  const [aLoading, setALoading] = useState(true)
  const [aError, setAError] = useState(false)
  const [metrics, setMetrics] = useState<any[]>([])
  const [mLoading, setMLoading] = useState(true)
  const [trendData, setTrendData] = useState<any>(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<string>('heart_rate')
  const alertIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

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
    try {
      const { data } = await api.GET('/alerts', { params: { query: { pageSize: 50 } } })
      setAlerts(data ?? [])
      setAError(false)
    } catch {
      setAError(true)
    } finally {
      setALoading(false)
    }
  }, [])

  const fetchMetrics = useCallback(async () => {
    setMLoading(true)
    try {
      const { data } = await api.GET('/data/metrics')
      setMetrics(data ?? [])
    } finally {
      setMLoading(false)
    }
  }, [])

  useEffect(() => { fetchPatients(); fetchAlerts(); fetchMetrics() }, [fetchPatients, fetchAlerts, fetchMetrics])
  useEffect(() => {
    alertIntervalRef.current = setInterval(fetchAlerts, 10000)
    return () => clearInterval(alertIntervalRef.current)
  }, [fetchAlerts])

  useEffect(() => {
    if (!patients.length) return
    setTrendLoading(true)
    api
      .GET('/data/aggregate', {
        params: {
          query: {
            patientId: patients[0]?.id ?? '',
            metric: selectedMetric,
            interval: 'day',
            fn: 'avg',
            from: new Date(Date.now() - 7 * 86400000).toISOString(),
          },
        },
      })
      .then(({ data }) => {
        setTrendData(data)
        setTrendLoading(false)
      })
      .catch(() => setTrendLoading(false))
  }, [patients, selectedMetric])

  const selectedDef = metrics.find((m: any) => m.metric === selectedMetric)

  const isLoading = pLoading || aLoading || mLoading
  const isError = pError || aError

  if (isLoading)
    return (
      <Box py="md" px="xl">
        <StateSkeleton variant="chart" />
      </Box>
    )
  if (isError)
    return (
      <Box py="md" px="xl">
        <StateError
          message="加载数据失败"
          onRetry={() => {
            fetchPatients()
            fetchAlerts()
          }}
        />
      </Box>
    )

  const activeAlerts = alerts.filter(
    (a: any) => a.status !== 'closed' && a.status !== 'resolved',
  )
  const patientCount = patients.length
  const criticalCount = activeAlerts.filter((a: any) => a.severity === 'critical').length

  return (
    <Box bg="matchaGreen.0" mih="calc(100vh - 56px)" py="md" px="xl">
      <Group justify="space-between" mb="md">
        <Title order={2}>数据监控大屏</Title>
        <Text size="xs" c="dimmed">
          {patientCount} 位患者 · {activeAlerts.length} 条活跃告警
        </Text>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="md">
        <StatCard
          label="在管患者"
          value={patientCount}
          color="matchaGreen"
          icon={<IconUsers size={14} />}
        />
        <StatCard
          label="活跃告警"
          value={activeAlerts.length}
          color="red"
          icon={<IconAlertTriangle size={14} />}
        />
        <StatCard
          label="严重告警"
          value={criticalCount}
          color="red"
          icon={<IconAlertTriangle size={14} />}
        />
      </SimpleGrid>

      <Paper p="md" withBorder mb="md">
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light">
              <IconChartLine size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600}>
              指标趋势
            </Text>
          </Group>
          <Select
            size="xs"
            data={metrics.map((m: any) => ({
              value: m.metric,
              label: `${m.displayName} (${m.unit})`,
            }))}
            value={selectedMetric}
            onChange={(v) => setSelectedMetric(v ?? 'heart_rate')}
            w={200}
          />
        </Group>
        {trendLoading ? (
          <StateSkeleton variant="chart" />
        ) : !trendData?.rows?.length ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            暂无数据
          </Text>
        ) : (
          <Box>
            <Group gap={0} align="flex-end" h={120}>
              {(trendData.rows as any[]).map((row: any, i: number) => {
                const maxVal = Math.max(...(trendData.rows as any[]).map((r: any) => r.value || 0), 1)
                const height = Math.max(4, ((row.value || 0) / maxVal) * 100)
                return (
                  <Box key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <Text size="xs" c="dimmed" mb={2}>
                      {row.value?.toFixed?.(1) ?? '-'}
                    </Text>
                    <Box
                      style={{
                        width: '80%',
                        height: `${height}%`,
                        backgroundColor: 'var(--mantine-color-teal-5)',
                        borderRadius: '4px 4px 0 0',
                        minHeight: 4,
                        transition: 'height 0.3s ease',
                      }}
                    />
                  </Box>
                )
              })}
            </Group>
            <Group justify="space-between" mt={4}>
              <Text size="xs" c="dimmed">
                {new Date(Date.now() - 7 * 86400000).toLocaleDateString('zh-CN')}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date().toLocaleDateString('zh-CN')}
              </Text>
            </Group>
          </Box>
        )}
      </Paper>

      <SimpleGrid cols={{ base: 1, lg: 2 }} mb="md">
        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed" mb="sm">
            实时告警流
          </Text>
          {activeAlerts.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" mt="md">
              暂无活跃告警
            </Text>
          ) : (
            activeAlerts.slice(0, 10).map((a: any) => (
              <Group key={a.id} gap="xs" mb={6}>
                <Badge
                  size="xs"
                  color={
                    a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'yellow' : 'blue'
                  }
                  variant="filled"
                >
                  {a.severity}
                </Badge>
                <Text size="xs">
                  {a.metric}: {a.value} {a.unit}
                </Text>
                <Text size="xs" c="dimmed">
                  {new Date(a.recordedAt).toLocaleTimeString('zh-CN')}
                </Text>
              </Group>
            ))
          )}
        </Paper>

        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed" mb="sm">
            患者概览
          </Text>
          <SimpleGrid cols={2} spacing="xs">
            {(patients ?? []).slice(0, 10).map((p: any) => (
              <Paper key={p.id} p="xs" withBorder>
                <Group gap={4}>
                  <Text size="xs" fw={500}>
                    {p.name}
                  </Text>
                  <Badge
                    size="xs"
                    color={p.status === 'active' ? 'matchaGreen' : 'gray'}
                    variant="light"
                  >
                    {p.status}
                  </Badge>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        </Paper>
      </SimpleGrid>
    </Box>
  )
}
