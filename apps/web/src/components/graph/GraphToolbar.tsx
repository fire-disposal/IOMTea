import React from 'react'
import { ActionIcon, Group, Paper, Text, Tooltip } from '@mantine/core'
import { IconArrowBackUp, IconArrowForwardUp, IconLayoutDashboard, IconSearch, IconZoomIn, IconZoomOut, IconMaximize } from '@tabler/icons-react'

interface GraphToolbarProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onAutoLayout: () => void
  onSearch: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
}

export function GraphToolbar({
  canUndo, canRedo, onUndo, onRedo,
  onAutoLayout, onSearch,
  onZoomIn, onZoomOut, onFitView,
}: GraphToolbarProps) {
  return (
    <Paper p={4} radius="md" withBorder shadow="sm" style={{ display: 'inline-flex' }}>
      <Group gap={2}>
        <Tooltip label="撤销">
          <ActionIcon size="sm" variant="subtle" disabled={!canUndo} onClick={onUndo}>
            <IconArrowBackUp size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="重做">
          <ActionIcon size="sm" variant="subtle" disabled={!canRedo} onClick={onRedo}>
            <IconArrowForwardUp size={16} />
          </ActionIcon>
        </Tooltip>
        <div style={{ width: 1, height: 20, background: 'var(--mantine-color-gray-3)', margin: '0 4px' }} />
        <Tooltip label="自动布局">
          <ActionIcon size="sm" variant="subtle" onClick={onAutoLayout}>
            <IconLayoutDashboard size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="搜索">
          <ActionIcon size="sm" variant="subtle" onClick={onSearch}>
            <IconSearch size={16} />
          </ActionIcon>
        </Tooltip>
        <div style={{ width: 1, height: 20, background: 'var(--mantine-color-gray-3)', margin: '0 4px' }} />
        <Tooltip label="放大">
          <ActionIcon size="sm" variant="subtle" onClick={onZoomIn}>
            <IconZoomIn size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="缩小">
          <ActionIcon size="sm" variant="subtle" onClick={onZoomOut}>
            <IconZoomOut size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="适应画布">
          <ActionIcon size="sm" variant="subtle" onClick={onFitView}>
            <IconMaximize size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Paper>
  )
}
