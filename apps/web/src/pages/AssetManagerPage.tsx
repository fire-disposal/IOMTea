import { useState, useMemo } from 'react'
import { Container, Title, SimpleGrid, Paper, Text, Group, ColorInput, Select, NumberInput, TextInput, Button, Stack, Tabs, ActionIcon } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ASSET_DEFS, getAsset, type AssetDef, type Sprite2D, type Model3D } from '@iomtea/shared-types/map'
import { Billboard3D } from '../map/renderers/Billboard3D'

const SHAPES = [
  { value: 'rect', label: '矩形' },
  { value: 'circle', label: '圆形' },
  { value: 'diamond', label: '菱形' },
  { value: 'line', label: '线条' },
  { value: 'icon', label: '图标' },
]

const MODEL_TYPES = [
  { value: 'box', label: '立方体' },
  { value: 'capsule', label: '胶囊' },
  { value: 'sphere', label: '球体' },
  { value: 'torus', label: '圆环' },
  { value: 'plane', label: '平面' },
]

function SpritePreview({ sprite, size = 64 }: { sprite: Sprite2D; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const sw = sprite.size[0] * size
  const sh = sprite.size[1] * size

  return (
    <svg width={size} height={size} style={{ display: 'block', background: '#f8f9fa', borderRadius: 4 }}>
      {(() => {
        switch (sprite.shape) {
          case 'circle':
            return <circle cx={cx} cy={cy} r={sw / 2} fill={sprite.color} />
          case 'diamond':
            return <polygon points={`${cx},${cy - sh / 2} ${cx + sw / 2},${cy} ${cx},${cy + sh / 2} ${cx - sw / 2},${cy}`} fill={sprite.color} />
          case 'line': {
            const hw = sprite.size[0] * size * 0.8
            const hh = sprite.size[1] * size * 0.8
            return <rect x={cx - hw / 2} y={cy - hh / 2} width={hw} height={hh} fill={sprite.color} rx={1} />
          }
          default: {
            const rx = (size - sw) / 2
            const ry = (size - sh) / 2
            return (
              <>
                <rect x={rx} y={ry} width={sw} height={sh} fill={sprite.color} rx={2} />
                {sprite.label && sw >= 20 && (
                  <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
                    fontSize={Math.min(11, sh * 0.7)} fill={sprite.labelColor || '#fff'}>
                    {sprite.label}
                  </text>
                )}
              </>
            )
          }
        }
      })()}
    </svg>
  )
}

function Model3DPreview({ asset }: { asset: AssetDef }) {
  if (!asset.model3D) {
    return (
      <div style={{ width: 120, height: 120, background: '#1a1a2e', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text size="xs" c="dimmed">无3D模型</Text>
      </div>
    )
  }
  return (
    <div style={{ width: 120, height: 120, borderRadius: 4, overflow: 'hidden' }}>
      <Canvas camera={{ position: [3, 2, 3], fov: 40 }} style={{ background: '#1a1a2e' }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Billboard3D sprite={asset.sprite2D} tileSize={1.5} layerY={0} position={[0, 0, 0]} />
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  )
}

export function AssetManagerPage() {
  const [assets, setAssets] = useState<AssetDef[]>(() =>
    ASSET_DEFS.map((a) => ({ ...a, sprite2D: { ...a.sprite2D }, model3D: a.model3D ? { ...a.model3D } : undefined })),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<'2D' | '3D'>('2D')

  const selected = useMemo(() => assets.find((a) => a.id === selectedId), [assets, selectedId])

  const updateSprite = (field: keyof Sprite2D, value: any) => {
    if (!selected) return
    setAssets((prev) =>
      prev.map((a) => (a.id === selected.id ? { ...a, sprite2D: { ...a.sprite2D, [field]: value } } : a)),
    )
  }

  const updateModel = (field: keyof Model3D, value: any) => {
    if (!selected) return
    setAssets((prev) =>
      prev.map((a) =>
        a.id === selected.id
          ? { ...a, model3D: { ...(a.model3D || { type: 'box', color: '#999', args: [1, 1, 1] }), [field]: value } }
          : a,
      ),
    )
  }

  const handleAddModel = () => {
    if (!selected) return
    setAssets((prev) =>
      prev.map((a) =>
        a.id === selected.id && !a.model3D
          ? { ...a, model3D: { type: 'box', color: '#999', args: [1, 1, 1] } }
          : a,
      ),
    )
  }

  const handleRemoveModel = () => {
    if (!selected) return
    setAssets((prev) =>
      prev.map((a) => (a.id === selected.id ? { ...a, model3D: undefined } : a)),
    )
  }

  return (
    <Container size="xl" py="md">
      <Title order={4} mb="md">资产管理</Title>

      <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="sm" mb="xl">
        {assets.map((asset) => (
          <Paper
            key={asset.id}
            p="sm"
            withBorder
            style={{ cursor: 'pointer', borderColor: selectedId === asset.id ? '#228be6' : undefined, borderWidth: selectedId === asset.id ? 2 : 1 }}
            onClick={() => setSelectedId(asset.id)}
          >
            <Group justify="center" mb="xs">
              <SpritePreview sprite={asset.sprite2D} size={48} />
            </Group>
            <Text size="xs" ta="center" fw={500}>{asset.id}</Text>
            <Text size="xs" ta="center" c="dimmed">{asset.model3D ? '2D+3D' : '2D only'}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      {selected && (
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={5}>{selected.id}</Title>
            <Tabs value={editMode} onChange={(v) => setEditMode(v as '2D' | '3D')}>
              <Tabs.List>
                <Tabs.Tab value="2D">2D 精灵</Tabs.Tab>
                <Tabs.Tab value="3D">3D 模型</Tabs.Tab>
              </Tabs.List>
            </Tabs>
          </Group>

          <Group align="flex-start" gap="xl" wrap="wrap">
            {editMode === '2D' ? (
              <>
                <Stack gap="xs" w={200}>
                  <Select label="形状" data={SHAPES} value={selected.sprite2D.shape}
                    onChange={(v) => v && updateSprite('shape', v)} />
                  <ColorInput label="颜色" value={selected.sprite2D.color}
                    onChange={(v) => updateSprite('color', v)} />
                  <NumberInput label="宽度" value={selected.sprite2D.size[0]}
                    onChange={(v) => updateSprite('size', [v ?? 0.8, selected.sprite2D.size[1]])}
                    min={0.1} max={2} step={0.05} />
                  <NumberInput label="高度" value={selected.sprite2D.size[1]}
                    onChange={(v) => updateSprite('size', [selected.sprite2D.size[0], v ?? 0.8])}
                    min={0.1} max={2} step={0.05} />
                  <TextInput label="标签" value={selected.sprite2D.label || ''}
                    onChange={(e) => updateSprite('label', e.currentTarget.value || undefined)} />
                  <ColorInput label="标签颜色" value={selected.sprite2D.labelColor || '#ffffff'}
                    onChange={(v) => updateSprite('labelColor', v)} />
                </Stack>

                <Paper p="md" withBorder bg="gray.0">
                  <Text size="xs" c="dimmed" mb="xs">2D 预览</Text>
                  <SpritePreview sprite={selected.sprite2D} size={120} />
                </Paper>
              </>
            ) : (
              <>
                {!selected.model3D ? (
                  <Stack gap="md">
                    <Text size="sm" c="dimmed">此资产暂无 3D 模型定义（将使用朝向相机的精灵图回退）</Text>
                    <Button size="xs" onClick={handleAddModel}>添加 3D 模型</Button>
                  </Stack>
                ) : (
                  <>
                    <Stack gap="xs" w={200}>
                      <Select label="类型" data={MODEL_TYPES} value={selected.model3D.type}
                        onChange={(v) => v && updateModel('type', v)} />
                      <ColorInput label="颜色" value={selected.model3D.color}
                        onChange={(v) => updateModel('color', v)} />
                      <TextInput label="参数" value={(selected.model3D.args || []).join(', ')}
                        onChange={(e) => {
                          const arr = e.currentTarget.value.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n))
                          updateModel('args', arr)
                        }} />
                      <ColorInput label="发光色" value={selected.model3D.emissiveColor || ''}
                        onChange={(v) => updateModel('emissiveColor', v || undefined)} />
                      <Button size="xs" color="red" variant="light" onClick={handleRemoveModel}>
                        移除 3D 模型
                      </Button>
                    </Stack>

                    <Paper p="md" withBorder bg="gray.0">
                      <Text size="xs" c="dimmed" mb="xs">3D 预览</Text>
                      <Model3DPreview asset={selected} />
                    </Paper>
                  </>
                )}
              </>
            )}
          </Group>
        </Paper>
      )}
    </Container>
  )
}
