import { Group, Paper, SimpleGrid, Text, ThemeIcon } from '@mantine/core'
import type { ReactNode } from 'react'

export interface StatsBarItem {
  label: string
  value: ReactNode
  icon: ReactNode
  color: string
}

interface StatsBarProps {
  items: StatsBarItem[]
  cols?: number
}

export function StatsBar({ items, cols = 3 }: StatsBarProps) {
  return (
    <SimpleGrid cols={cols} mb="lg">
      {items.map((item) => (
        <Paper
          key={item.label}
          p="md"
          radius="md"
          withBorder
          className="card-hover"
          style={{ borderLeft: `3px solid var(--mantine-color-${item.color}-5)` }}
        >
          <Group>
            <ThemeIcon color={item.color} variant="light" size="lg">
              {item.icon}
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                {item.label}
              </Text>
              <Text fw={700} size="xl">
                {item.value}
              </Text>
            </div>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  )
}
