import { useState, useCallback, useEffect, useRef } from 'react'
import { Button, Group, Modal, Paper, SegmentedControl, SimpleGrid, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { type TileFlag, packGrid, TEMPLATES } from '@iomtea/shared-types'
import { trpc } from '../trpc'
import { useHomeMap } from '../hooks/useHomeMap'
import { TwinScene3D } from './TwinScene3D'
import { TileMap3D } from './TileMap3D'
import { ThingModels3D } from './ThingModels3D'

type PaintMode = 'wall' | 'floor' | 'door' | 'erase' | 'thing'

const PAINT_TO_TILE: Record<string, TileFlag> = { wall: 2, floor: 1, door: 3 }

export function MapEditor3D({ patientId }: { patientId: string }) {
  const { runtime, isLoading, error } = useHomeMap(patientId)
  const trpcUtils = trpc.useUtils()

  const updateGridMutation = trpc.homeMap.updateGrid.useMutation()
  const generateMutation = trpc.homeMap.generateFromTemplate.useMutation()

  const [grid, setGrid] = useState<TileFlag[][] | null>(null)
  const [mode, setMode] = useState<PaintMode>('wall')
  const [dirty, setDirty] = useState(false)
  const [templateModal, setTemplateModal] = useState(false)

  useEffect(() => {
    if (runtime && !grid) {
      setGrid(runtime.tileGrid.map((row) => [...row]))
    }
  }, [runtime])

  const handleTileClick = useCallback((x: number, z: number) => {
    if (!grid) return
    setGrid((prev) => {
      if (!prev) return prev
      const next = prev.map((row) => [...row])
      const flag = mode === 'erase' ? 0 : (PAINT_TO_TILE[mode] ?? 1)
      if (next[z] && next[z][x] !== undefined) {
        next[z][x] = flag
      }
      return next
    })
    setDirty(true)
  }, [grid, mode])

  const handleSave = useCallback(async () => {
    if (!grid || !runtime) return
    try {
      await updateGridMutation.mutateAsync({ mapId: runtime.map.id, packedGrid: packGrid(grid) })
      setDirty(false)
      trpcUtils.homeMap.getByPatient.invalidate({ patientId })
      notifications.show({ title: '已保存', message: '地图已保存', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: '保存失败', message: err?.message, color: 'red' })
    }
  }, [grid, runtime, patientId, updateGridMutation, trpcUtils])

  const handleTemplateSelect = useCallback(async (templateId: string) => {
    try {
      await generateMutation.mutateAsync({ patientId, templateId: templateId as any })
      setTemplateModal(false)
      setGrid(null)
      trpcUtils.homeMap.getByPatient.invalidate({ patientId })
      notifications.show({ title: '已生成', message: '地图已从模板生成', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: '生成失败', message: err?.message, color: 'red' })
    }
  }, [patientId, generateMutation, trpcUtils])

  if (isLoading) return <Text c="dimmed" ta="center" py="xl">加载中...</Text>
  if (error) return <Text c="red" ta="center" py="xl">加载地图失败</Text>
  if (!grid && !runtime) return <Text c="dimmed" ta="center" py="xl">暂无地图，请从模板生成</Text>

  const w = grid ? grid[0]?.length ?? 0 : 0
  const h = grid ? grid.length : 0

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Group px="md" py="sm" bg="gray.0" justify="space-between" style={{ borderBottom: '1px solid #ddd' }}>
        <Group gap="xs">
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(v) => setMode(v as PaintMode)}
            data={[
              { label: '墙', value: 'wall' },
              { label: '地板', value: 'floor' },
              { label: '门', value: 'door' },
              { label: '擦除', value: 'erase' },
            ]}
          />
        </Group>
        <Group gap="xs">
          <Button size="xs" variant="light" onClick={() => setTemplateModal(true)}>模板</Button>
          <Button size="xs" onClick={handleSave} disabled={!dirty} loading={updateGridMutation.isPending}>保存</Button>
        </Group>
      </Group>

      <div style={{ flex: 1, position: 'relative' }}>
        <TwinScene3D showGrid centerX={w / 2} centerZ={h / 2}>
          {grid && (
            <>
              <TileMap3D grid={grid} onClick={handleTileClick} interactive />
              {runtime && <ThingModels3D things={runtime.things} gridW={w} gridH={h} />}
            </>
          )}
        </TwinScene3D>

        <Paper p="xs" style={{ position: 'absolute', bottom: 8, left: 8, opacity: 0.8 }} shadow="xs">
          <Text size="xs" c="dimmed">
            {w}×{h} 网格 | {runtime?.things.length ?? 0} 物品
            {dirty ? ' · 未保存' : ''}
          </Text>
        </Paper>
      </div>

      <Modal opened={templateModal} onClose={() => setTemplateModal(false)} title="从模板生成" size="md">
        <SimpleGrid cols={2} spacing="md">
          {Object.values(TEMPLATES).map((tpl) => (
            <Paper key={tpl.id} p="md" withBorder style={{ cursor: 'pointer' }} onClick={() => handleTemplateSelect(tpl.id)}>
              <Text fw={600} size="sm">{tpl.label}</Text>
              <Text size="xs" c="dimmed">{tpl.width}×{tpl.height} · {tpl.things.length} 物品</Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Modal>
    </div>
  )
}