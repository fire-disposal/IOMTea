import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/modals/styles.css'
import { App } from './App'
import { getTrpcClient, trpc } from './trpc'

const queryClient = new QueryClient()
const trpcClient = getTrpcClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={{ primaryColor: 'blue', defaultRadius: 'md' }}>
          <ModalsProvider>
            <Notifications />
            <App />
          </ModalsProvider>
        </MantineProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>,
)
