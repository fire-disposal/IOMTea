import { createTRPCReact, type CreateTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@server/core/trpc/routers/_app'

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>()

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc',
        headers() {
          const token = localStorage.getItem('token')
          return token ? { Authorization: `Bearer ${token}` } : {}
        },
      }),
    ],
  })
}
