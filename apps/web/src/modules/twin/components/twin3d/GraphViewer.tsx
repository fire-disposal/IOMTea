import { ActionIcon, Badge, Box, Button, Group, Paper, Stack, Text, Tooltip } from '@mantine/core'
import {
  IconBolt,
  IconMap,
  IconPlayerPause,
  IconPlayerPlay,
  IconSpeedboat,
} from '@tabler/icons-react'
import { RoomNodeGraph } from './RoomNodeGraph'
import { trpc } from '../../../../trpc'
import { useRealtime } from '../../../../hooks/useRealtime'

const SPEEDS = [1, 2, 5, 10]

interface GraphViewerProps {
  patientId: string
  isRunning: boolean
  speed: number
  onCreateMap: () => void
  onCreateMapPending: boolean
  onPlayPause: () => void
  isPausePending: boolean
  isResumePending: boolean
  onSpeedCycle: () => void
  isSpeedPending: boolean
  onInjectScenario: () => void
  onEditMap: () => void
}

export function GraphViewer({
  patientId,
  isRunning,
  speed,
  onCreateMap,
  onCreateMapPending,
  onPlayPause,
  isPausePending,
  isResumePending,
  onSpeedCycle,
  isSpeedPending,
  onInjectScenario,
  onEditMap,
}: GraphViewerProps) {
  const graph = trpc.homeGraph.get.useQuery({ patientId }, { enabled: !!patientId })
  useRealtime(undefined, undefined, patientId)

  const rooms = graph.data?.rooms ?? []
  const personRoomId = graph.data?.personLocation ?? null
  const roomStates = graph.data?.roomStates ?? []
  const coverage = graph.data?.coverage
  const hasGraph = rooms.length > 0

  const renderScene = () => {
    if (graph.isLoading)
      return (
        <Text c="dimmed" ta="center" pt="xl">
          加载中...
        </Text>
      )
    if (!hasGraph) {
      return (
        <Stack h="100%" align="center" justify="center" gap="md">
          <Text c="dimmed" size="sm">
            居家图尚未配置
          </Text>
          <Button size="sm" onClick={onCreateMap} loading={onCreateMapPending}>
            创建居家图
          </Button>
        </Stack>
      )
    }

    return <RoomNodeGraph rooms={rooms} personRoomId={personRoomId} roomStates={roomStates} />
  }

  return (
    <>
      <Paper
        p="md"
        radius="md"
        withBorder
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <Group justify="space-between" mb="sm">
          <Group gap={8}>
            <Text fw={600}>数字孪生</Text>
            {personRoomId && (
              <Badge color="red" variant="light" size="sm">
                有人
              </Badge>
            )}
            {coverage && (
              <Badge color="gray" variant="outline" size="sm">
                📷{coverage.covered.length} 🔮{coverage.inferrable.length} ❓{coverage.blind.length}
              </Badge>
            )}
            <Badge color={isRunning ? 'green' : 'gray'} variant="light" size="sm">
              {isRunning ? '运行中' : '已暂停'}
            </Badge>
          </Group>
          <Group gap={4}>
            <Tooltip label={isRunning ? '暂停' : '播放'}>
              <ActionIcon
                variant="subtle"
                onClick={onPlayPause}
                loading={isPausePending || isResumePending}
              >
                {isRunning ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label={`${speed}x → ${SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]}x`}>
              <ActionIcon variant="subtle" onClick={onSpeedCycle} loading={isSpeedPending}>
                <IconSpeedboat size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="场景注入">
              <ActionIcon variant="subtle" onClick={onInjectScenario} color="orange">
                <IconBolt size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="编辑居家图">
              <ActionIcon variant="subtle" onClick={onEditMap}>
                <IconMap size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Box flex={1} mih={0} style={{ borderRadius: 8, overflow: 'hidden' }}>
          {renderScene()}
        </Box>
      </Paper>
    </>
  )
}
