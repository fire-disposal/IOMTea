import { Group, Badge, Text } from '@mantine/core'
import { useGet } from '../api/hooks'

interface Tag { id: string; name: string; color: string | null }

interface Props {
  selected: string[]
  onChange: (tags: string[]) => void
}

export function TagFilter({ selected, onChange }: Props) {
  const { data: tags } = useGet<Tag[]>('/tags')

  const toggle = (name: string) => {
    if (selected.includes(name)) onChange(selected.filter((t) => t !== name))
    else onChange([...selected, name])
  }

  return (
    <Group gap="xs">
      <Text size="sm" c="dimmed">筛选:</Text>
      {(tags ?? []).map((t) => (
        <Badge
          key={t.id}
          size="sm"
          variant={selected.includes(t.name) ? 'filled' : 'outline'}
          color={t.color || 'gray'}
          style={{ cursor: 'pointer' }}
          onClick={() => toggle(t.name)}
        >
          {t.name}
        </Badge>
      ))}
    </Group>
  )
}
