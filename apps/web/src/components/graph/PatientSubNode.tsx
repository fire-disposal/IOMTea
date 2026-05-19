import React, { memo } from 'react'
import { Badge, Group, Paper, Text, Tooltip } from '@mantine/core'
import { IconUser } from '@tabler/icons-react'

export interface PatientSubNodeData {
  id: string
  name: string
  latestVitals?: { metric: string; value: number; unit: string }[]
}

export const PatientSubNode: React.FC<{ data: PatientSubNodeData; onRemove: (id: string) => void }> = memo(
  ({ data, onRemove }) => {
    return (
      <Paper p={4} radius="sm" withBorder bg="matchaGreen.0" style={{ position: 'relative' }}>
        <Group gap={4} wrap="nowrap">
          <IconUser size={12} color="var(--mantine-color-matchaGreen-6)" />
          <Tooltip label={data.name}>
            <Text size="xs" fw={500} style={{ maxWidth: 80 }} truncate="end">{data.name}</Text>
          </Tooltip>
          <Text
            size="xs"
            c="dimmed"
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onRemove(data.id) }}
          >
            &#10005;
          </Text>
        </Group>
        {data.latestVitals && data.latestVitals.length > 0 && (
          <Group gap={4} mt={2}>
            {data.latestVitals.slice(0, 3).map((v) => (
              <Badge key={v.metric} size="xs" variant="light" color="matchaGreen">
                {v.metric}: {v.value?.toFixed(0)} {v.unit}
              </Badge>
            ))}
          </Group>
        )}
      </Paper>
    )
  },
)
