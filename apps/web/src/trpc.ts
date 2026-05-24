import type { AppRouter } from '@server/core/trpc/routers/_app'
import { httpBatchLink } from '@trpc/client'
import { type CreateTRPCReact, createTRPCReact } from '@trpc/react-query'
import { useAuthStore } from './store/auth'

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>()

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const oldRefresh = localStorage.getItem('refreshToken')
    if (!oldRefresh) return null
    try {
      const res = await fetch('/trpc/auth.refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: oldRefresh }),
      })
      if (!res.ok) return null
      const data = await res.json()
      const result = data.result?.data
      if (result?.accessToken) {
        localStorage.setItem('token', result.accessToken)
        localStorage.setItem('refreshToken', result.refreshToken)
        localStorage.setItem('expiresAt', String(result.expiresAt))
        useAuthStore.getState().setTokens(result.accessToken, result.refreshToken, result.expiresAt)
        return result.accessToken
      }
      return null
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/trpc',
        fetch: async (input, init) => {
          const token = localStorage.getItem('token')
          const headers = new Headers(init?.headers)
          if (token) headers.set('Authorization', `Bearer ${token}`)
          const response = await fetch(input, { ...init, headers })

          if (response.status === 401) {
            const newToken = await refreshAccessToken()
            if (newToken) {
              headers.set('Authorization', `Bearer ${newToken}`)
              return fetch(input, { ...init, headers })
            }
            localStorage.removeItem('token')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('expiresAt')
            window.location.href = '/login'
          }
          return response
        },
      }),
    ],
  })
}
