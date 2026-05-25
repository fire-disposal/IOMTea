import { ActionIcon, Button, Center, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconAlertTriangle, IconDatabaseOff, IconRefresh } from '@tabler/icons-react'

export function StateSkeleton({
  count = 3,
  variant = 'card',
}: { count?: number; variant?: 'card' | 'table' | 'chart' }) {
  const height = variant === 'chart' ? 400 : variant === 'table' ? 52 : 140
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} radius="md" mb={variant === 'table' ? 4 : undefined} />
      ))}
    </>
  )
}

export function StateEmpty({
  message = '暂无数据',
  action,
  actionLabel,
}: {
  message?: string
  action?: () => void
  actionLabel?: string
}) {
  return (
    <Center py={60}>
      <Stack align="center" gap="md">
        <ThemeIcon size={64} radius="xl" color="matchaGreen" variant="light">
          <IconDatabaseOff size={32} />
        </ThemeIcon>
        <Text c="dimmed" size="lg">
          {message}
        </Text>
        {action && (
          <Button variant="light" onClick={action}>
            {actionLabel}
          </Button>
        )}
      </Stack>
    </Center>
  )
}

export function StateError({
  message = '加载失败',
  onRetry,
}: { message?: string; onRetry?: () => void }) {
  return (
    <Center py={60}>
      <Stack align="center" gap="md">
        <ThemeIcon size={64} radius="xl" color="red" variant="light">
          <IconAlertTriangle size={32} />
        </ThemeIcon>
        <Text c="red" size="lg">
          {message}
        </Text>
        {onRetry && (
          <ActionIcon variant="subtle" onClick={onRetry}>
            <IconRefresh size={24} />
          </ActionIcon>
        )}
      </Stack>
    </Center>
  )
}
