import { Button, Container, Text, Title } from '@mantine/core'
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { Component, type ReactNode } from 'react'
import { theme } from '../theme'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: false },
  },
})

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <Container py="xl" ta="center">
          <Title order={3} mb="md" c="red">页面出错了</Title>
          <Text size="sm" c="dimmed" mb="md">{this.state.error?.message || '未知错误'}</Text>
          <Button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}>
            刷新页面
          </Button>
        </Container>
      )
    }
    return this.props.children
  }
}

export function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <ModalsProvider>
          <Notifications />
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  )
}
