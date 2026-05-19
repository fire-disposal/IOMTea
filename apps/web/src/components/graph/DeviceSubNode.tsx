import React, { memo } from 'react'
import { Badge, Group, Paper, Text, Tooltip } from '@mantine/core'
import { IconDeviceLaptop, IconActivity, IconHeartRateMonitor, IconRouter } from '@tabler/icons-react'

const deviceIcons: Record<string, React.ReactNode> = {
  mattress: <IconDeviceLaptop size={12} />,
  vision: <IconDeviceLaptop size={12} />,
  imu: <IconActivity size={12} />,
  generic: <IconRouter size={12} />,
  simulator: <IconRouter size={12} />,
  custom: <IconDeviceLaptop size={12} />,
  virtual: <IconHeartRateMonitor size={12} />,
  pin: <IconRouter size={12} />,
}

const typeLabels: Record<string, string> = {
  mattress: '床垫',
  vision: '视觉',
  imu: 'IMU',
  generic: '通用',
  simulator: '仿真',
  custom: '自定义',
  virtual: '虚拟',
  pin: '物联',
}

export interface DeviceSubNodeData {
  id: string
  label: string
  deviceType: string
  status: string
  latestMetric?: { metric: string; value: number; unit: string }
}

export const DeviceSubNode: React.FC<{ data: DeviceSubNodeData; onRemove: (id: string) => void }> = memo(
  ({ data, onRemove }) => {
    const icon = deviceIcons[data.deviceType] ?? <IconRouter size={12} />
    const label = typeLabels[data.deviceType] ?? data.deviceType
    const online = data.status === 'active'

    return (
      <Paper p={4} radius="sm" withBorder bg={online ? 'green.0' : 'gray.0'} style={{ position: 'relative' }}>
        <Group gap={4} wrap="nowrap">
          <span style={{ color: online ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-gray-5)' }}>
            {icon}
          </span>
          <Tooltip label={data.label}>
            <Text size="xs" fw={500} style={{ maxWidth: 80 }} truncate="end">{data.label}</Text>
          </Tooltip>
          <Badge size="xs" variant="dot" color={online ? 'green' : 'gray'} />
          <Text
            size="xs"
            c="dimmed"
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onRemove(data.id) }}
          >
            &#10005;
          </Text>
        </Group>
        {data.latestMetric && (
          <Text size="xs" c="dimmed">
            {data.latestMetric.metric}: {data.latestMetric.value.toFixed(0)} {data.latestMetric.unit}
          </Text>
        )}
      </Paper>
    )
  },
)
