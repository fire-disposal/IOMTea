import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import { trpc, getTrpcClient } from './trpc'
import { App } from './App'

const queryClient = new QueryClient()
const trpcClient = getTrpcClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <Notifications />
          <App />
        </MantineProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>,
)
