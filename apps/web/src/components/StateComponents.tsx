import { Center, Container, Paper, Skeleton, Stack, Text } from '@mantine/core'

export function StateSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Container py="md">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={24} mb="sm" />
      ))}
    </Container>
  )
}

export function StateEmpty({ message }: { message: string }) {
  return (
    <Container py="md">
      <Paper p="xl" withBorder ta="center">
        <Text c="dimmed" size="sm">
          {message}
        </Text>
      </Paper>
    </Container>
  )
}
