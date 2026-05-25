import createClient from 'openapi-fetch'
import type { paths } from './types'

const baseUrl = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

export const api = createClient<paths>({
  baseUrl,
  headers: () => {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
})

api.use({
  async onResponse({ response }) {
    if (response.status === 401) {
      localStorage.removeItem('token')
      const currentPath = window.location.pathname
      if (currentPath !== '/login') {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
      }
    }
  },
})
