/// <reference types="@react-three/fiber" />
import { useState, useMemo } from 'react'
import { Badge, ColorSwatch, Container, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { Canvas } from '@react-three/fiber'
import { ASSET_DEFS, getAsset, type AssetDef, type Sprite2D, type Model3D } from '@iomtea/shared-types/map'
import { Billboard3D } from '../map/renderers/Billboard3D'
import { OrbitControls } from '@react-three/drei'

const SHAPES = [
  { value: 'rect', label: '矩形' },
  { value: 'circle', label: '圆形' },
  { value: 'diamond', label: '菱形' },
  { value: 'line', label: '线条' },
  { value: 'icon', label: '图标' },
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
        <Text size="xs" c="dimmed">无3D模型→精灵回退</Text>
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
  const [selectedId, setSelectedId] = useState<string | null>(ASSET_DEFS[0]?.id || null)
  const selected = useMemo(() => ASSET_DEFS.find((a) => a.id === selectedId), [selectedId])

  return (
    <Container size="xl" py="md">
      <Title order={4} mb="md">资产管理</Title>
      <Text size="xs" c="dimmed" mb="md">浏览内置资产定义。扩展资源包请编辑 ASSET_DEFS 注册表。</Text>

      <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="sm" mb="xl">
        {ASSET_DEFS.map((asset) => (
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
          <Title order={5} mb="md">{selected.id}</Title>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <Paper p="md" withBorder bg="gray.0">
              <Text size="xs" fw={600} c="dimmed" mb="xs">2D 精灵</Text>
              <Stack gap={4}>
                <Group gap="xs"><Text size="xs" c="dimmed" miw={40}>形状</Text><Badge size="xs" variant="light">{SHAPES.find(s => s.value === selected.sprite2D.shape)?.label}</Badge></Group>
                <Group gap="xs"><Text size="xs" c="dimmed" miw={40}>颜色</Text><ColorSwatch color={selected.sprite2D.color} size={14} /><Text size="xs">{selected.sprite2D.color}</Text></Group>
                <Group gap="xs"><Text size="xs" c="dimmed" miw={40}>尺寸</Text><Text size="xs">{selected.sprite2D.size[0]}×{selected.sprite2D.size[1]}</Text></Group>
                {selected.sprite2D.label && <Group gap="xs"><Text size="xs" c="dimmed" miw={40}>标签</Text><Badge size="xs">{selected.sprite2D.label}</Badge></Group>}
              </Stack>
            </Paper>
            <Paper p="md" withBorder bg="gray.0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SpritePreview sprite={selected.sprite2D} size={120} />
            </Paper>
            <Paper p="md" withBorder bg="gray.0">
              <Text size="xs" fw={600} c="dimmed" mb="xs">3D 模型</Text>
              {selected.model3D ? (
                <Stack gap={4}>
                  <Group gap="xs"><Text size="xs" c="dimmed" miw={40}>类型</Text><Badge size="xs" variant="light">{selected.model3D.type}</Badge></Group>
                  <Group gap="xs"><Text size="xs" c="dimmed" miw={40}>颜色</Text><ColorSwatch color={selected.model3D.color} size={14} /><Text size="xs">{selected.model3D.color}</Text></Group>
                  <Group gap="xs"><Text size="xs" c="dimmed" miw={40}>参数</Text><Text size="xs">{(selected.model3D.args || []).join(', ')}</Text></Group>
                </Stack>
              ) : <Text size="xs" c="dimmed">无 3D 模型（使用精灵回退）</Text>}
            </Paper>
            <Paper p="md" withBorder bg="gray.0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Model3DPreview asset={selected} />
            </Paper>
          </SimpleGrid>
        </Paper>
      )}
    </Container>
  )
}
