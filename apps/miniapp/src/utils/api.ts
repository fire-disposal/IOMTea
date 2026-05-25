import Taro from '@tarojs/taro'
import type { paths } from '../api/types'

function getBase(): string {
  return (Taro.getStorageSync('server_url') as string) || 'http://localhost:3000'
}

function getToken(): string | null {
  return (Taro.getStorageSync('token') as string) || null
}

async function request<T>(path: string, options: {
  method?: string
  body?: unknown
  params?: Record<string, string | number | undefined>
} = {}): Promise<T> {
  const { method = 'GET', body, params } = options
  const base = getBase()
  const token = getToken()

  let url = `${base}${path}`
  if (params) {
    const parts: string[] = []
    for (const k of Object.keys(params)) {
      const v = params[k]
      if (v !== undefined) parts.push(`${k}=${encodeURIComponent(String(v))}`)
    }
    if (parts.length > 0) url += `?${parts.join('&')}`
  }

  return new Promise((resolve, reject) => {
    Taro.request({
      url,
      method: method as any,
      header: token ? { Authorization: `Bearer ${token}`, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
      data: body ?? undefined,
      success(res) {
        if (res.statusCode === 401) {
          Taro.removeStorageSync('token')
          Taro.reLaunch({ url: '/pages/login/index' })
          reject(new Error('Unauthorized'))
          return
        }
        resolve(res.data as T)
      },
      fail(err) {
        reject(new Error(err.errMsg || 'Network error'))
      },
    })
  })
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) =>
    request<T>(path, { params }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
}
