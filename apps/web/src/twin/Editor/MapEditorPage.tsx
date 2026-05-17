import { useState, useCallback, useEffect } from 'react'
import { Container, Group, Paper, Text, Modal, SimpleGrid, Button, Loader, Alert } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useParams } from '@tanstack/react-router'
import { type TileFlag, packGrid, placeTile, TEMPLATES, canPlaceThing, getThingDef } from '@iomtea/shared-types'
import { trpc } from '../../trpc'
import { useHomeMap } from '../../hooks/useHomeMap'
import { HomeMapCanvas } from '../HomeMapCanvas'
import { Toolbar } from './Toolbar'
import { EditorPalette } from './EditorPalette'
import { PaintTool } from './PaintTool'
import { ThingPlacer } from './ThingPlacer'
import type { EditorMode, PaintType } from './EditorTypes'

const PAINT_INIT: PaintType = 1 as PaintType

export function MapEditorPage() {
  const { id } = (useParams as any)({ from: '/_auth/patients/$id' })
  const patientId = id
  const { runtime, isLoading, error } = useHomeMap(patientId)
  const trpcUtils = trpc.useUtils()

  const updateGridMutation = trpc.homeMap.updateGrid.useMutation()
  const placeThingMutation = trpc.homeMap.placeThing.useMutation()
  const generateMutation = trpc.homeMap.generateFromTemplate.useMutation()

  const [mode, setMode] = useState<EditorMode>('paint')
  const [paintType, setPaintType] = useState<PaintType>(PAINT_INIT)
  const [selectedThingDef, setSelectedThingDef] = useState<string | null>(null)
  const [selectedThingId, setSelectedThingId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [grid, setGrid] = useState<TileFlag[][] | null>(null)
  const [templateModal, setTemplateModal] = useState(false)

  useEffect(() => {
    if (runtime && !grid) {
      setGrid(runtime.tileGrid.map((row) => [...row]))
    }
  }, [runtime])

  const handlePaint = useCallback((newGrid: TileFlag[][]) => {
    setGrid(newGrid)
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!grid || !runtime) return
    try {
      const packed = packGrid(grid)
      await updateGridMutation.mutateAsync({ mapId: runtime.map.id, packedGrid: packed })
      setDirty(false)
      trpcUtils.homeMap.getByPatient.invalidate({ patientId: patientId! })
      notifications.show({ title: '已保存', message: '地图已保存', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: '保存失败', message: err?.message || '未知错误', color: 'red' })
    }
  }, [grid, runtime, patientId, updateGridMutation, trpcUtils])

  const handleThingPlaced = useCallback(async (thingType: string, x: number, y: number) => {
    if (!runtime || !patientId) return
    try {
      await placeThingMutation.mutateAsync({
        mapId: runtime.map.id,
        thing: { thingType, tileX: x, tileY: y },
      })
      trpcUtils.homeMap.getByPatient.invalidate({ patientId })
      notifications.show({ title: '已放置', message: '物体已放置', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: '放置失败', message: err?.message || '未知错误', color: 'red' })
    }
  }, [runtime, patientId, placeThingMutation, trpcUtils])

  const handleTemplateSelect = useCallback(async (templateId: string) => {
    if (!patientId) return
    try {
      await generateMutation.mutateAsync({ patientId, templateId: templateId as any })
      setTemplateModal(false)
      setGrid(null)
      trpcUtils.homeMap.getByPatient.invalidate({ patientId })
      notifications.show({ title: '已生成', message: '地图已从模板生成', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: '生成失败', message: err?.message || '未知错误', color: 'red' })
    }
  }, [patientId, generateMutation, trpcUtils])

  const handleSelectThing = useCallback((x: number, y: number) => {
    if (!runtime) return
    const clicked = runtime.things.find((t) => {
      return x >= t.tileX && x < t.tileX + t.tileW && y >= t.tileY && y < t.tileY + t.tileH
    })
    setSelectedThingId(clicked?.id ?? null)
  }, [runtime])

  if (isLoading) return <Container><Loader /></Container>
  if (error) return <Container><Alert color="red">加载地图失败</Alert></Container>
  if (!runtime) return <Container><Alert color="yellow">该患者暂无地图，请从模板生成</Alert></Container>

  return (
    <Container fluid p={0} style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        mode={mode}
        onModeChange={setMode}
        paintType={paintType}
        onPaintTypeChange={setPaintType}
        onSave={handleSave}
        onOpenTemplate={() => setTemplateModal(true)}
        dirty={dirty}
      />

      <Group style={{ flex: 1, overflow: 'hidden' }} gap={0} wrap="nowrap" align="flex-start">
        {mode === 'thing' && (
          <EditorPalette
            selectedType={selectedThingDef}
            onSelect={setSelectedThingDef}
          />
        )}

        <Paper shadow="xs" p="sm" withBorder style={{ flex: 1, overflow: 'auto' }}>
          {mode === 'paint' && grid && (
            <PaintTool
              runtime={runtime}
              workingGrid={grid}
              paintType={paintType}
              onGridChanged={handlePaint}
            />
          )}

          {mode === 'thing' && selectedThingDef && grid && (
            <ThingPlacer
              runtime={runtime}
              workingGrid={grid}
              selectedThingDef={selectedThingDef}
              onThingPlaced={handleThingPlaced}
            />
          )}

          {mode === 'select' && (
            <HomeMapCanvas
              runtime={runtime}
              cellSize={36}
              onTileClick={handleSelectThing}
            />
          )}
        </Paper>
      </Group>

      <Group px="xs" py={4} bg="gray.1" justify="space-between">
        <Text size="xs" c="dimmed">
          网格: {runtime.tileGrid.length}×{runtime.tileGrid[0]?.length ?? 0} |
          物体: {runtime.things.length} |
          {selectedThingId ? ` 选中: ${selectedThingId.slice(0, 16)}` : ''}
          {dirty ? ' *未保存' : ''}
        </Text>
      </Group>

      <Modal
        opened={templateModal}
        onClose={() => setTemplateModal(false)}
        title="从模板生成地图"
        size="md"
      >
        <SimpleGrid cols={2} spacing="md">
          {Object.values(TEMPLATES).map((tpl) => (
            <Paper
              key={tpl.id}
              p="md"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => handleTemplateSelect(tpl.id)}
            >
              <Text fw={600} size="sm">{tpl.label}</Text>
              <Text size="xs" c="dimmed">{tpl.width}×{tpl.height}</Text>
              <Text size="xs" c="dimmed">物体: {tpl.things.length}</Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Modal>
    </Container>
  )
}
