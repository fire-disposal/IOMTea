import axios from 'axios'
import type { paths } from './types'

const http = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
})

let proactiveRefreshPromise: Promise<void> | null = null

function getTokenExpiry(token: string): Date | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.exp) return null
    return new Date(payload.exp * 1000)
  } catch {
    return null
  }
}

http.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token')
  if (!token) return config

  const expiry = getTokenExpiry(token)
  if (expiry && expiry.getTime() - Date.now() < 5 * 60 * 1000) {
    if (!proactiveRefreshPromise) {
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        proactiveRefreshPromise = axios
          .post('http://localhost:3000/auth/refresh', { refreshToken })
          .then(({ data }) => {
            localStorage.setItem('token', data.accessToken)
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
          })
          .catch(() => {})
          .finally(() => {
            proactiveRefreshPromise = null
          })
      }
    }
    await proactiveRefreshPromise
  }

  const currentToken = localStorage.getItem('token')
  if (currentToken) config.headers.Authorization = `Bearer ${currentToken}`
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token!)
  })
  failedQueue = []
}

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config
    if (err.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(err)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return http(originalRequest)
        })
        .catch((e) => Promise.reject(e))
    }

    originalRequest._retry = true
    isRefreshing = true

    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      localStorage.removeItem('token')
      if (window.location.pathname !== '/login') {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
      }
      return Promise.reject(err)
    }

    try {
      const { data } = await axios.post('http://localhost:3000/auth/refresh', {
        refreshToken,
      })
      const newToken = data.accessToken
      const newRefresh = data.refreshToken
      localStorage.setItem('token', newToken)
      if (newRefresh) localStorage.setItem('refreshToken', newRefresh)
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      processQueue(null, newToken)
      return http(originalRequest)
    } catch (refreshErr) {
      processQueue(refreshErr, null)
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      if (window.location.pathname !== '/login') {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
      }
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  },
)

export { http }
export type { paths }
