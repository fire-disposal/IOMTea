import { useState, useEffect, useCallback } from 'react'
import {
  Container,
  Title,
  Group,
  Table,
  Badge,
  Modal,
  ActionIcon,
  Text,
  SegmentedControl,
  Stack,
} from '@mantine/core'
import { IconEye, IconRefresh } from '@tabler/icons-react'
import { api } from '../api/client'
import { StateSkeleton, StateEmpty, StateError } from '../components/shared/StateComponents'

const TYPE_LABELS: Record<string, string> = {
  device: '设备',
  virtual: '虚拟',
  user: '用户',
  simulator: '模拟器',
}
const TYPE_COLORS: Record<string, string> = {
  device: 'blue',
  virtual: 'violet',
  user: 'green',
  simulator: 'orange',
}

export function PinManagementPage() {
  const [pins, setPins] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [detailPin, setDetailPin] = useState<any>(null)
  const [timelineMinutes, setTimelineMinutes] = useState(30)

  const fetchPins = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<any[]>('/pins')
      setPins(data)
      setIsError(false)
    } catch {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchPins() }, [fetchPins])

  const filtered = pins.filter((p: any) => typeFilter === 'all' || p.type === typeFilter)

  if (isLoading)
    return (
      <Container size="xl" py="md">
        <Title order={2} mb="lg">
          PIN 管理
        </Title>
        <StateSkeleton variant="table" count={5} />
      </Container>
    )
  if (isError)
    return (
      <Container size="xl" py="md">
        <Title order={2} mb="lg">
          PIN 管理
        </Title>
        <StateError message="加载失败" onRetry={fetchPins} />
      </Container>
    )

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>PIN 管理</Title>
        <ActionIcon variant="subtle" onClick={fetchPins}>
          <IconRefresh size={16} />
        </ActionIcon>
      </Group>

      <SegmentedControl
        mb="md"
        data={[
          { value: 'all', label: '全部' },
          { value: 'device', label: '设备' },
          { value: 'virtual', label: '虚拟' },
          { value: 'user', label: '用户' },
          { value: 'simulator', label: '模拟器' },
        ]}
        value={typeFilter}
        onChange={setTypeFilter}
      />

      {filtered.length === 0 ? (
        <StateEmpty message="暂无匹配的 PIN" />
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>PIN</Table.Th>
              <Table.Th>类型</Table.Th>
              <Table.Th>标签</Table.Th>
              <Table.Th>描述</Table.Th>
              <Table.Th>最后活跃</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map((p: any) => (
              <Table.Tr key={p.pin}>
                <Table.Td>
                  <Text fw={600} ff="monospace">
                    {p.pin}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={TYPE_COLORS[p.type] ?? 'gray'} variant="light">
                    {TYPE_LABELS[p.type] ?? p.type}
                  </Badge>
                </Table.Td>
                <Table.Td>{p.label || '-'}</Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {p.description || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleString() : '从未活跃'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="light"
                    color="blue"
                    onClick={() => {
                      setDetailPin(p)
                      setTimelineMinutes(30)
                    }}
                  >
                    <IconEye size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={!!detailPin}
        onClose={() => setDetailPin(null)}
        title={detailPin ? `PIN ${detailPin.pin} — 数据溯源` : ''}
        size="xl"
      >
        {detailPin && (
          <Stack>
            <Group>
              <Badge color={TYPE_COLORS[detailPin.type]} variant="filled">
                {TYPE_LABELS[detailPin.type]}
              </Badge>
              <Text size="sm">{detailPin.label || detailPin.pin}</Text>
              {detailPin.description && (
                <Text size="xs" c="dimmed">
                  {detailPin.description}
                </Text>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              此 PIN 关联的所有数据提交记录：
            </Text>
          </Stack>
        )}
      </Modal>
    </Container>
  )
}
