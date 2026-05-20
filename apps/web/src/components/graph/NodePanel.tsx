import React, { useState } from 'react'
import { ActionIcon, Badge, Group, Paper, Stack, Tabs, Text, TextInput, Tooltip } from '@mantine/core'
import { IconDevices2, IconGripVertical, IconSearch, IconUserPlus, IconPlus } from '@tabler/icons-react'

interface NodePanelItem {
  id: string
  label: string
  deviceType?: string
  status?: string
  latestVitals?: { metric: string; value: number; unit: string }[]
  roomId?: string | null
  patientId?: string | null
}

interface NodePanelProps {
  devices: NodePanelItem[]
  patients: NodePanelItem[]
  onCreateRoom: () => void
}

export function NodePanel({
  devices, patients, onCreateRoom,
}: NodePanelProps) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<string | null>('devices')

  const filteredDevices = devices.filter((d) =>
    !search || d.label?.toLowerCase().includes(search.toLowerCase()),
  )
  const filteredPatients = patients.filter((p) =>
    !search || p.label?.toLowerCase().includes(search.toLowerCase()),
  )

  const handleDragStart = (item: NodePanelItem, type: 'device' | 'patient') => (e: React.DragEvent) => {
    e.dataTransfer.setData('application/node-panel', JSON.stringify({ id: item.id, type }))
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <Paper p="sm" withBorder h="100%" style={{ overflow: 'auto' }}>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={600}>节点面板</Text>
          <Tooltip label="创建房间">
            <ActionIcon size="sm" variant="light" onClick={onCreateRoom}>
              <IconPlus size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <TextInput
          size="xs"
          placeholder="搜索..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />

        {(devices.length > 0 || patients.length > 0) ? (
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="devices" leftSection={<IconDevices2 size={14} />}>
                未分配设备 ({devices.length})
              </Tabs.Tab>
              <Tabs.Tab value="patients" leftSection={<IconUserPlus size={14} />}>
                患者 ({patients.length})
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="devices" pt="xs">
              <Stack gap={4}>
                {filteredDevices.length === 0 ? (
                  <Text size="xs" c="dimmed" ta="center" py="md">暂无未分配设备</Text>
                ) : (
                  filteredDevices.map((d) => (
                    <Paper
                      key={d.id}
                      p="xs"
                      radius="sm"
                      withBorder
                      style={{ cursor: 'grab' }}
                      draggable
                      onDragStart={handleDragStart(d, 'device')}
                    >
                      <Group gap="xs" wrap="nowrap">
                        <IconGripVertical size={12} style={{ color: 'var(--mantine-color-gray-5)' }} />
                        <Text size="xs" fw={500} style={{ flex: 1 }} truncate="end">{d.label}</Text>
                        <Badge size="xs" variant="dot" color={d.status === 'active' ? 'green' : 'gray'} />
                      </Group>
                    </Paper>
                  ))
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="patients" pt="xs">
              <Stack gap={4}>
                {filteredPatients.length === 0 ? (
                  <Text size="xs" c="dimmed" ta="center" py="md">暂无患者</Text>
                ) : (
                  filteredPatients.map((p) => (
                    <Paper
                      key={p.id}
                      p="xs"
                      radius="sm"
                      withBorder
                      style={{ cursor: 'grab' }}
                      draggable
                      onDragStart={handleDragStart(p, 'patient')}
                    >
                      <Group gap="xs" wrap="nowrap">
                        <IconGripVertical size={12} style={{ color: 'var(--mantine-color-gray-5)' }} />
                        <Text size="xs" fw={500} style={{ flex: 1 }} truncate="end">{p.label}</Text>
                        {p.latestVitals && p.latestVitals.length > 0 && (
                          <Text size="xs" c="dimmed">
                            {p.latestVitals[0].metric}: {p.latestVitals[0].value?.toFixed(0)}
                          </Text>
                        )}
                      </Group>
                    </Paper>
                  ))
                )}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        ) : (
          <Text size="xs" c="dimmed" ta="center" py="xl">
            暂无未分配设备或患者
          </Text>
        )}
      </Stack>
    </Paper>
  )
}
