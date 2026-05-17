import { ActionIcon, Badge, Button, Group, Modal, Paper, Text, Tooltip } from '@mantine/core'
import { IconBolt, IconMap, IconMaximize, IconPlayerPause, IconPlayerPlay, IconSpeedboat } from '@tabler/icons-react'
import { useState } from 'react'
import type { HomeMapRuntime } from '@iomtea/shared-types'
import { TwinScene3D } from './TwinScene3D'
import { TileMap3D } from './TileMap3D'
import { ThingModels3D } from './ThingModels3D'

const SPEEDS = [1, 2, 5, 10]

interface TwinViewer3DProps {
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
}

export function TwinViewer3D({
  mapRuntime, mapLoading, mapError,
  isRunning, speed,
  onCreateMap, onCreateMapPending,
  onPlayPause, isPausePending, isResumePending,
  onSpeedCycle, isSpeedPending,
  onInjectScenario, onEditMap,
}: TwinViewer3DProps) {
  const [fullscreen, setFullscreen] = useState(false)

  const renderScene = (full: boolean) => {
    if (mapLoading) return <Text c="dimmed" ta="center" pt="xl">加载中...</Text>
    if (mapError) return <Text c="red" ta="center" pt="xl">加载地图失败</Text>
    if (!mapRuntime) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
          <Text c="dimmed" size="sm">地图尚未配置</Text>
          <Button size="sm" onClick={onCreateMap} loading={onCreateMapPending}>创建地图</Button>
        </div>
      )
    }

    const w = mapRuntime.tileGrid[0]?.length ?? 0
    const h = mapRuntime.tileGrid.length

    return (
      <TwinScene3D showGizmo={full} centerX={w / 2} centerZ={h / 2}>
        <TileMap3D grid={mapRuntime.tileGrid} />
        <ThingModels3D things={mapRuntime.things} gridW={w} gridH={h} />
      </TwinScene3D>
    )
  }

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
            <Tooltip label="编辑地图">
              <ActionIcon variant="subtle" onClick={onEditMap}>
                <IconMap size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="全屏">
              <ActionIcon variant="subtle" onClick={() => setFullscreen(true)}>
                <IconMaximize size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <div style={{ flex: 1, minHeight: 0, borderRadius: 8, overflow: 'hidden' }}>
          {renderScene(false)}
        </div>
      </Paper>

      <Modal opened={fullscreen} onClose={() => setFullscreen(false)} fullScreen title="数字孪生 — 3D">
        <div style={{ width: '100%', height: 'calc(100vh - 100px)', borderRadius: 8, overflow: 'hidden' }}>
          {renderScene(true)}
        </div>
      </Modal>
    </>
  )
}