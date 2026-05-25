import { Skeleton, Text, Center, Button, Stack, Container, Paper } from '@mantine/core'

export function StateSkeleton({ lines = 3 }: { lines?: number }) {
  return <Container py="md">{Array.from({ length: lines }, (_, i) => <Skeleton key={i} height={24} mb="sm" />)}</Container>
}

export function StateError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Container py="md">
      <Paper p="xl" withBorder ta="center">
        <Stack align="center">
          <Text c="red" size="sm">{message}</Text>
          {onRetry && <Button variant="light" size="sm" onClick={onRetry}>重试</Button>}
        </Stack>
      </Paper>
    </Container>
  )
}

export function StateEmpty({ message }: { message: string }) {
  return (
    <Container py="md">
      <Paper p="xl" withBorder ta="center">
        <Text c="dimmed" size="sm">{message}</Text>
      </Paper>
    </Container>
  )
}
