import { Outlet } from '@tanstack/react-router'
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { theme } from '../theme'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

export function RootLayout() {
  return (
    <MantineProvider theme={theme}>
      <ModalsProvider>
        <Notifications />
        <Outlet />
      </ModalsProvider>
    </MantineProvider>
  )
}
