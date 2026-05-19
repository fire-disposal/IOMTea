import { Group, Paper, SimpleGrid, Skeleton, Text, ThemeIcon } from '@mantine/core'
import { AccentPaper } from './AccentPaper'
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
  loading?: boolean
}

export function StatsBar({ items, cols = 3, loading = false }: StatsBarProps) {
  return (
    <SimpleGrid cols={cols} mb="lg">
      {items.map((item) => (
        <AccentPaper
          key={item.label}
          p="md"
          radius="md"
          withBorder
          className="card-hover"
          color={item.color}
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
                {loading ? <Skeleton height={40} /> : item.value}
              </Text>
            </div>
          </Group>
        </AccentPaper>
      ))}
    </SimpleGrid>
  )
}
