import { useState } from 'react'
import { Paper, Stack, TextInput, SimpleGrid, Text, ScrollArea } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { BUILTIN_THINGS, getThingDef } from '@iomtea/shared-types'

interface EditorPaletteProps {
  selectedType: string | null
  onSelect: (thingType: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  structure: '#868e96',
  device: '#4a90d9',
  furnishing: '#8e6f47',
}

const CATEGORY_LABELS: Record<string, string> = {
  structure: '结构',
  device: '设备',
  furnishing: '家具',
}

export function EditorPalette({ selectedType, onSelect }: EditorPaletteProps) {
  const [search, setSearch] = useState('')

  const filtered = BUILTIN_THINGS.filter(
    (t) => t.label.includes(search) || t.type.includes(search),
  )

  const grouped = filtered.reduce<Record<string, typeof BUILTIN_THINGS>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {})

  return (
    <Paper p="sm" w={200} withBorder style={{ flexShrink: 0 }}>
      <Stack gap={4}>
        <TextInput
          size="xs"
          placeholder="搜索物体..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <ScrollArea h="calc(100vh - 200px)">
          {Object.entries(grouped).map(([category, things]) => (
            <Stack key={category} gap={2} mb="xs">
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                {CATEGORY_LABELS[category] || category}
              </Text>
              <SimpleGrid cols={1} spacing={2}>
                {things.map((thing) => (
                  <Paper
                    key={thing.type}
                    p={4}
                    withBorder
                    style={{
                      cursor: 'pointer',
                      background: selectedType === thing.type ? 'var(--mantine-color-blue-1)' : undefined,
                      borderColor: selectedType === thing.type ? 'var(--mantine-color-blue-5)' : undefined,
                    }}
                    onClick={() => onSelect(thing.type)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 2,
                          background: CATEGORY_COLORS[category] || '#868e96',
                          flexShrink: 0,
                        }}
                      />
                      <Text size="xs">{thing.label}</Text>
                      <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>
                        {thing.tileW}×{thing.tileH}
                      </Text>
                    </div>
                  </Paper>
                ))}
              </SimpleGrid>
            </Stack>
          ))}
        </ScrollArea>
      </Stack>
    </Paper>
  )
}
