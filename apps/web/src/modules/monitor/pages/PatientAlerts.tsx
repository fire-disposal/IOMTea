import {
  Badge,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Skeleton,
  Text,
  Title,
  Timeline,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconBell, IconCheck, IconInfoCircle } from '@tabler/icons-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from '@tanstack/react-router'
import { api } from '../../../api/client'
import { StateEmpty, StateError } from '../../../components/shared/StateComponents'

const severityColor: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' }
const severityLabel: Record<string, string> = { critical: '严重', warning: '警告', info: '信息' }
const statusLabel: Record<string, string> = {
  active: '活跃',
  acknowledged: '已确认',
  resolved: '已解决',
}
const statusColor: Record<string, string> = {
  active: 'red',
  acknowledged: 'yellow',
  resolved: 'green',
}

const severityData = [
  { label: '全部', value: 'all' },
  { label: '严重', value: 'critical' },
  { label: '警告', value: 'warning' },
  { label: '信息', value: 'info' },
]

const statusData = [
  { label: '全部', value: 'all' },
  { label: '活跃', value: 'active' },
  { label: '已确认', value: 'acknowledged' },
  { label: '已解决', value: 'resolved' },
]

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

export function PatientAlerts() {
  const { id } = useParams({ from: '/_auth/patients/$id' })
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [alerts, setAlerts] = useState<any[]>([])
  const [aLoading, setALoading] = useState(true)
  const [aError, setAError] = useState(false)
  const [ackLoadingId, setAckLoadingId] = useState<string | null>(null)
  const [resolveLoadingId, setResolveLoadingId] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const fetchAlerts = useCallback(async () => {
    if (!id) return
    try {
      const params: Record<string, string | number | undefined> = {
        patientId: id,
        pageSize: 50,
      }
      if (severityFilter !== 'all') params.severity = severityFilter
      if (statusFilter !== 'all') params.status = statusFilter
      const data = await api.get<any[]>('/alerts', params)
      setAlerts(data)
      setAError(false)
    } catch {
      setAError(true)
    } finally {
      setALoading(false)
    }
  }, [id, severityFilter, statusFilter])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])
  useEffect(() => {
    intervalRef.current = setInterval(fetchAlerts, 15000)
    return () => clearInterval(intervalRef.current)
  }, [fetchAlerts])

  const acknowledge = async (alertId: string) => {
    setAckLoadingId(alertId)
    try {
      await api.patch(`/alerts/${alertId}`, { action: 'acknowledge' })
      notifications.show({ title: '已确认告警', message: '', color: 'blue' })
      fetchAlerts()
    } catch (err: any) {
      notifications.show({ title: '操作失败', message: err.message, color: 'red' })
    } finally {
      setAckLoadingId(null)
    }
  }

  const resolve = async (alertId: string) => {
    setResolveLoadingId(alertId)
    try {
      await api.patch(`/alerts/${alertId}`, { action: 'resolve' })
      notifications.show({ title: '已解决告警', message: '', color: 'green' })
      fetchAlerts()
    } catch (err: any) {
      notifications.show({ title: '操作失败', message: err.message, color: 'red' })
    } finally {
      setResolveLoadingId(null)
    }
  }

  if (aLoading) {
    return (
      <Paper p="lg" radius="md" withBorder>
        <Skeleton height={28} width={200} mb="md" />
        <Skeleton height={32} mb="md" />
        <Skeleton height={200} />
      </Paper>
    )
  }

  if (aError) {
    return (
      <Paper p="lg" radius="md" withBorder>
        <StateError message="加载告警数据失败" />
      </Paper>
    )
  }

  if (!alerts || alerts.length === 0) {
    return (
      <Paper p="lg" radius="md" withBorder>
        <StateEmpty message="暂无告警记录" />
      </Paper>
    )
  }

  const items = alerts as any[]

  const counts: Record<string, number> = { critical: 0, warning: 0, info: 0 }
  for (const a of items) {
    if (counts[a.severity] !== undefined) counts[a.severity]++
  }

  return (
    <Paper p="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={4}>告警记录</Title>
      </Group>

      <Group gap="md" mb="md">
        <Badge
          size="lg"
          color="red"
          variant="light"
          leftSection={
            <Text inherit fw={600}>
              {counts.critical}
            </Text>
          }
        >
          严重
        </Badge>
        <Badge
          size="lg"
          color="orange"
          variant="light"
          leftSection={
            <Text inherit fw={600}>
              {counts.warning}
            </Text>
          }
        >
          警告
        </Badge>
        <Badge
          size="lg"
          color="blue"
          variant="light"
          leftSection={
            <Text inherit fw={600}>
              {counts.info}
            </Text>
          }
        >
          信息
        </Badge>
      </Group>

      <Group gap="md" mb="md">
        <SegmentedControl
          size="xs"
          value={severityFilter}
          onChange={(v) => setSeverityFilter(v)}
          data={severityData}
        />
        <SegmentedControl
          size="xs"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          data={statusData}
        />
      </Group>

      <Timeline
        active={items.filter((a: any) => a.status === 'active').length - 1}
        bulletSize={24}
        lineWidth={2}
      >
        {items.map((a: any) => (
          <Timeline.Item
            key={a.id}
            bullet={
              a.severity === 'critical' ? (
                <IconAlertTriangle size={12} color="red" />
              ) : a.severity === 'warning' ? (
                <IconBell size={12} color="orange" />
              ) : (
                <IconInfoCircle size={12} />
              )
            }
            title={
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Group gap="xs">
                  <Text fw={500}>{a.metric}</Text>
                  <Badge size="xs" color={severityColor[a.severity] || 'gray'}>
                    {severityLabel[a.severity] || a.severity}
                  </Badge>
                  <Badge size="xs" color={statusColor[a.status] || 'gray'}>
                    {statusLabel[a.status] || a.status}
                  </Badge>
                </Group>
                <Group gap="xs">
                  {a.status === 'active' && (
                    <Button
                      size="compact-xs"
                      variant="light"
                      color="blue"
                      leftSection={<IconCheck size={12} />}
                      onClick={() => acknowledge(a.id)}
                      loading={ackLoadingId === a.id}
                    >
                      确认
                    </Button>
                  )}
                  {(a.status === 'active' || a.status === 'acknowledged') && (
                    <Button
                      size="compact-xs"
                      variant="light"
                      color="green"
                      leftSection={<IconCheck size={12} />}
                      onClick={() => resolve(a.id)}
                      loading={resolveLoadingId === a.id}
                    >
                      解决
                    </Button>
                  )}
                </Group>
              </Group>
            }
          >
            <Text size="sm" c="dimmed">
              {a.value != null ? `${a.value} ${a.unit || ''}` : ''} ·{' '}
              {relativeTime(new Date(a.recordedAt))}
            </Text>
          </Timeline.Item>
        ))}
      </Timeline>
    </Paper>
  )
}
