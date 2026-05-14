import { Badge, Group, Paper, Text, Timeline } from '@mantine/core'
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react'
import { useParams } from 'react-router-dom'
import { trpc } from '../trpc'
import { StateEmpty } from '../components/shared/StateComponents'

export function PatientAlerts() {
  const { id } = useParams<{ id: string }>()
  const alerts = trpc.alert.list.useQuery({ patientId: id, pageSize: 50 }, { enabled: !!id })

  if (!alerts.data || alerts.data.length === 0) {
    return <StateEmpty message="暂无告警记录" />
  }

  return (
    <Paper p="md" radius="md">
      <Timeline active={alerts.data.length} bulletSize={24} lineWidth={2}>
        {alerts.data.map((a: any) => (
          <Timeline.Item
            key={a.id}
            bullet={
              a.severity === 'critical' ? <IconAlertTriangle size={12} color="red" /> : <IconInfoCircle size={12} />
            }
            title={
              <Group gap="xs">
                <Text fw={500}>{a.metric}</Text>
                <Badge size="xs" color={a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'orange' : 'blue'}>
                  {a.severity}
                </Badge>
                <Badge size="xs" color={a.status === 'active' ? 'red' : a.status === 'acknowledged' ? 'yellow' : 'green'}>
                  {a.status}
                </Badge>
              </Group>
            }
          >
            <Text size="sm" c="dimmed">
              {a.value != null ? `${a.value} ${a.unit || ''}` : ''} · {new Date(a.recordedAt).toLocaleString()}
            </Text>
          </Timeline.Item>
        ))}
      </Timeline>
    </Paper>
  )
}
