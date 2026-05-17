import { ActionIcon, Alert, Badge, Button, Group, Loader, Modal, Paper, Text, Tooltip } from '@mantine/core'
import { IconBolt, IconMap, IconMaximize, IconPlayerPause, IconPlayerPlay, IconPlus, IconSpeedboat } from '@tabler/icons-react'
import type { HomeMapRuntime } from '@iomtea/shared-types'
import { HomeMapCanvas } from '../../twin'

interface TwinViewerProps {
  mapRuntime: HomeMapRuntime | null
  mapLoading: boolean
  mapError: unknown
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
  fullscreenOpen: boolean
  onFullscreenOpen: () => void
  onFullscreenClose: () => void
}

function MapContent({
  mapRuntime, mapLoading, mapError, onCreateMap, onCreateMapPending,
}: {
  mapRuntime: HomeMapRuntime | null
  mapLoading: boolean
  mapError: unknown
  onCreateMap: () => void
  onCreateMapPending: boolean
}) {
  if (mapLoading) return <Loader />
  if (mapError) return <Alert color="red">加载地图失败</Alert>
  if (!mapRuntime) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <Text c="dimmed" size="sm">地图尚未配置</Text>
        <Button size="sm" leftSection={<IconPlus size={16} />} onClick={onCreateMap} loading={onCreateMapPending}>
          创建地图
        </Button>
      </div>
    )
  }
  return <HomeMapCanvas runtime={mapRuntime} cellSize={36} showRoomOverlay />
}

export function TwinViewer({
  mapRuntime, mapLoading, mapError,
  isRunning, speed,
  onCreateMap, onCreateMapPending,
  onPlayPause, isPausePending, isResumePending,
  onSpeedCycle, isSpeedPending,
  onInjectScenario, onEditMap,
  fullscreenOpen, onFullscreenOpen, onFullscreenClose,
}: TwinViewerProps) {
  const SPEEDS = [1, 2, 5, 10]

  return (
    <>
      <Paper p="md" radius="md" withBorder style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <Group justify="space-between" mb="sm">
          <Group gap={8}>
            <Text fw={600}>数字孪生</Text>
            <Badge color={isRunning ? 'green' : 'gray'} variant="light" size="sm">
              {isRunning ? '运行中' : '已暂停'}
            </Badge>
            <Badge variant="outline" size="sm">{speed}x</Badge>
          </Group>
          <Group gap={4}>
            <Tooltip label={isRunning ? '暂停' : '播放'}>
              <ActionIcon variant="subtle" onClick={onPlayPause} loading={isPausePending || isResumePending}>
                {isRunning ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label={`倍速 ${speed}x → ${SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]}x`}>
              <ActionIcon variant="subtle" onClick={onSpeedCycle} loading={isSpeedPending}>
                <IconSpeedboat size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="场景注入">
              <ActionIcon variant="subtle" onClick={onInjectScenario} color="orange">
                <IconBolt size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="编辑地图">
              <ActionIcon variant="subtle" onClick={onEditMap}>
                <IconMap size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="全屏">
              <ActionIcon variant="subtle" onClick={onFullscreenOpen}>
                <IconMaximize size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <div style={{ flex: 1, minHeight: 0, borderRadius: 8, overflow: 'hidden', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MapContent mapRuntime={mapRuntime} mapLoading={mapLoading} mapError={mapError} onCreateMap={onCreateMap} onCreateMapPending={onCreateMapPending} />
        </div>
      </Paper>

      <Modal opened={fullscreenOpen} onClose={onFullscreenClose} fullScreen title="数字孪生 — 全屏">
        <div style={{ width: '100%', height: 'calc(100vh - 100px)', borderRadius: 8, overflow: 'hidden', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MapContent mapRuntime={mapRuntime} mapLoading={mapLoading} mapError={mapError} onCreateMap={onCreateMap} onCreateMapPending={onCreateMapPending} />
        </div>
      </Modal>
    </>
  )
}