import createClient from 'openapi-fetch'
import type { paths } from './types'

const baseUrl = 'http://localhost:3000'

export const api = createClient<paths>({ baseUrl })

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
