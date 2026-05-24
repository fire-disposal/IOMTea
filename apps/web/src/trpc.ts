import type { AppRouter } from '@server/core/trpc/routers/_app'
import { httpBatchLink } from '@trpc/client'
import { type CreateTRPCReact, createTRPCReact } from '@trpc/react-query'
import { useAuthStore } from './store/auth'

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>()

let refreshPromise: Promise<string | null> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

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
        scheduleProactiveRefresh(result.expiresAt)
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

function scheduleProactiveRefresh(expiresAt: number) {
  if (refreshTimer) clearTimeout(refreshTimer)
  const msUntilExpiry = expiresAt - Date.now()
  const refreshIn = Math.max(msUntilExpiry - 5 * 60 * 1000, 0) // 5 minutes before expiry
  if (refreshIn > 0) {
    refreshTimer = setTimeout(() => refreshAccessToken(), refreshIn)
  }
}

// Schedule on initial load
const storedExpiresAt = Number(localStorage.getItem('expiresAt'))
if (storedExpiresAt && storedExpiresAt > Date.now()) {
  scheduleProactiveRefresh(storedExpiresAt)
}

function clearAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('expiresAt')
  if (refreshTimer) clearTimeout(refreshTimer)
  useAuthStore.getState().logout()
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
            clearAuth()
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
          }
          return response
        },
      }),
    ],
  })
}
